const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MiniCppCompileError extends Error {
  constructor(message, line = 1, col = 1, code = 'inbuilt-cpp:compile') {
    super(String(message || 'Inbuilt C++ compile error'));
    this.name = 'MiniCppCompileError';
    this.line = Math.max(1, Number(line) || 1);
    this.col = Math.max(1, Number(col) || 1);
    this.code = String(code || 'inbuilt-cpp:compile');
  }
}

class MiniCppRuntimeError extends Error {
  constructor(message, line = 1, col = 1, code = 'inbuilt-cpp:runtime') {
    super(String(message || 'Inbuilt C++ runtime error'));
    this.name = 'MiniCppRuntimeError';
    this.line = Math.max(1, Number(line) || 1);
    this.col = Math.max(1, Number(col) || 1);
    this.code = String(code || 'inbuilt-cpp:runtime');
  }
}

function indexToLineCol(text, index) {
  const src = String(text || '');
  const idx = Math.max(0, Math.min(src.length, Number(index) || 0));
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx; i += 1) {
    if (src.charAt(i) === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

function stripCommentsPreserveLayout(sourceText) {
  const src = String(sourceText || '');
  let out = '';
  let i = 0;
  let mode = 'code';
  let quote = '';
  while (i < src.length) {
    const ch = src.charAt(i);
    const next = src.charAt(i + 1);
    if (mode === 'line-comment') {
      if (ch === '\n') {
        mode = 'code';
        out += '\n';
      } else out += ' ';
      i += 1;
      continue;
    }
    if (mode === 'block-comment') {
      if (ch === '*' && next === '/') {
        out += '  ';
        i += 2;
        mode = 'code';
        continue;
      }
      out += (ch === '\n' ? '\n' : ' ');
      i += 1;
      continue;
    }
    if (mode === 'string' || mode === 'char') {
      out += ch;
      if (ch === '\\') {
        const esc = src.charAt(i + 1);
        if (esc) {
          out += esc;
          i += 2;
          continue;
        }
      }
      if (ch === quote) {
        mode = 'code';
        quote = '';
      }
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      out += '  ';
      i += 2;
      mode = 'line-comment';
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      mode = 'block-comment';
      continue;
    }
    if (ch === '"' || ch === "'") {
      out += ch;
      quote = ch;
      mode = ch === '"' ? 'string' : 'char';
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function splitTopLevelOperator(text, op) {
  const src = String(text || '');
  const out = [];
  let buf = '';
  let i = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let mode = 'code';
  let quote = '';
  while (i < src.length) {
    const ch = src.charAt(i);
    if (mode === 'string' || mode === 'char') {
      buf += ch;
      if (ch === '\\') {
        const esc = src.charAt(i + 1);
        if (esc) {
          buf += esc;
          i += 2;
          continue;
        }
      }
      if (ch === quote) {
        mode = 'code';
        quote = '';
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      mode = ch === '"' ? 'string' : 'char';
      quote = ch;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0 && src.startsWith(op, i)) {
      out.push(buf.trim());
      buf = '';
      i += op.length;
      continue;
    }

    buf += ch;
    i += 1;
  }
  if (buf.trim() || out.length) out.push(buf.trim());
  return out.filter((p) => p !== '');
}

function stripCppPreprocessorBasic(sourceText) {
  const src = String(sourceText || '');
  const lines = src.split('\n');
  const macros = new Map();
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || '');
    const trimmed = raw.trim();
    if (!trimmed.startsWith('#')) {
      let line = raw;
      for (const [name, value] of macros.entries()) {
        line = line.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(value));
      }
      out.push(line);
      continue;
    }
    if (/^#\s*include\b/i.test(trimmed)) {
      out.push('');
      continue;
    }
    if (/^#\s*define\b/i.test(trimmed)) {
      const m = trimmed.match(/^#\s*define\s+([A-Za-z_]\w*)\s*(.*)$/i);
      if (!m) {
        throw new MiniCppCompileError('Invalid #define directive in inbuilt C++ compiler', i + 1, 1, 'inbuilt-cpp:preprocessor');
      }
      const tail = String(m[2] || '');
      if (tail.trimStart().startsWith('(')) {
        throw new MiniCppCompileError(`Function-like macros are not supported: #define ${m[1]}(...)`, i + 1, 1, 'inbuilt-cpp:preprocessor');
      }
      macros.set(String(m[1] || ''), tail.trim() || '');
      out.push('');
      continue;
    }
    if (/^#\s*undef\b/i.test(trimmed)) {
      const m = trimmed.match(/^#\s*undef\s+([A-Za-z_]\w*)/i);
      if (m) macros.delete(String(m[1] || ''));
      out.push('');
      continue;
    }
    // Basic first: ignore pragma/line and reject others.
    if (/^#\s*(pragma|line)\b/i.test(trimmed)) {
      out.push('');
      continue;
    }
    throw new MiniCppCompileError(`Unsupported preprocessor directive in inbuilt C++ compiler: ${trimmed.split(/\s+/).slice(0, 2).join(' ')}`, i + 1, 1, 'inbuilt-cpp:preprocessor');
  }
  return out.join('\n');
}

function rejectUnsupportedCppSyntax(sourceText) {
  const src = String(sourceText || '');
  const checks = [
    { re: /\b(?:class|template|typename)\b/, msg: 'class/template/typename are not supported by inbuilt C++ compiler yet', code: 'inbuilt-cpp:unsupported-type' },
    { re: /\bnamespace\b(?!\s+std\b)/, msg: 'Custom namespaces are not supported by inbuilt C++ compiler yet', code: 'inbuilt-cpp:unsupported-namespace' },
    { re: /->/, msg: 'Pointer member access (->) is not supported by inbuilt C++ compiler yet', code: 'inbuilt-cpp:unsupported-pointer' },
    { re: /\bnew\b|\bdelete\b/, msg: 'new/delete are not supported by inbuilt C++ compiler yet', code: 'inbuilt-cpp:unsupported-memory' },
    { re: /\btry\b|\bcatch\b|\bthrow\b/, msg: 'Exceptions are not supported by inbuilt C++ compiler yet', code: 'inbuilt-cpp:unsupported-exception' }
  ];
  for (const check of checks) {
    const m = check.re.exec(src);
    if (!m) continue;
    const loc = indexToLineCol(src, m.index);
    throw new MiniCppCompileError(check.msg, loc.line, loc.col, check.code);
  }
}

function collectCppTypeHints(sourceText) {
  const src = String(sourceText || '');
  const hints = new Map();
  const normalizeType = (raw) => {
    let t = String(raw || '').replace(/\bconst\b/g, ' ').replace(/\bvolatile\b/g, ' ');
    t = t.replace(/\s+/g, ' ').trim().toLowerCase();
    t = t.replace(/^std::/, '');
    if (/\bstring\b/.test(t)) return 'string';
    if (/\bbool\b/.test(t)) return 'bool';
    if (/\bchar\b/.test(t)) return 'char';
    if (/\bfloat\b|\bdouble\b/.test(t)) return 'double';
    if (/\b(?:unsigned|signed|short|long|int)\b/.test(t)) return 'int';
    if (/\bauto\b/.test(t)) return 'auto';
    return '';
  };

  const declRegex = /(^|[;\{\}\n]\s*)((?:const\s+)?(?:std::)?(?:string|bool|char|float|double|int|long|short|unsigned|signed|auto)(?:\s+(?:long|int))*)\s+([^;]+);/gm;
  src.replace(declRegex, (full, _prefix, typeText, body) => {
    const kind = normalizeType(typeText);
    const parts = String(body || '').split(',');
    for (const partRaw of parts) {
      const part = String(partRaw || '').trim();
      if (!part) continue;
      const lhs = part.split('=')[0].trim();
      const m = lhs.match(/^[*&\s]*([A-Za-z_]\w*)/);
      if (!m) continue;
      hints.set(String(m[1] || ''), kind || 'auto');
    }
    return full;
  });

  const fnSigRegex = /(^|[;\}\n]\s*)((?:const\s+)?(?:std::)?(?:string|bool|char|float|double|int|long|short|unsigned|signed|void)(?:\s+(?:long|int))*)\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*\{/gm;
  src.replace(fnSigRegex, (full, _prefix, _ret, _name, params) => {
    const paramList = String(params || '').trim();
    if (!paramList || paramList === 'void') return full;
    const chunks = paramList.split(',');
    for (const chunkRaw of chunks) {
      const chunk = String(chunkRaw || '').trim();
      if (!chunk) continue;
      const m = chunk.match(/^(.+?)\s+[*&\s]*([A-Za-z_]\w*)$/);
      if (!m) continue;
      hints.set(String(m[2] || ''), normalizeType(m[1]) || 'auto');
    }
    return full;
  });

  const forDeclRegex = /\bfor\s*\(\s*((?:const\s+)?(?:std::)?(?:string|bool|char|float|double|int|long|short|unsigned|signed|auto)(?:\s+(?:long|int))*)\s+([A-Za-z_]\w*)/g;
  src.replace(forDeclRegex, (full, typeText, name) => {
    hints.set(String(name || ''), normalizeType(typeText) || 'auto');
    return full;
  });
  return hints;
}

function extractCppParamNames(paramText) {
  const raw = String(paramText || '').trim();
  if (!raw || raw === 'void') return '';
  return raw.split(',').map((partRaw, idx) => {
    let part = String(partRaw || '').trim();
    if (!part) return `arg${idx}`;
    part = part.replace(/\b(?:const|volatile|register)\b/g, ' ');
    part = part.replace(/\b(?:std::)?(?:string|bool|char|float|double|int|void|long|short|unsigned|signed|auto)\b/g, ' ');
    part = part.replace(/\[[^\]]*\]/g, ' ');
    const m = part.match(/([A-Za-z_]\w*)\s*$/);
    return m ? m[1] : `arg${idx}`;
  }).join(', ');
}

function convertCppFunctionSignatures(sourceText) {
  const src = String(sourceText || '');
  const fnRegex = /(^|[;\}\n]\s*)(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:(?:std::)?string|int|void|float|double|char|bool)\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*\{/gm;
  return src.replace(fnRegex, (full, prefix, name, params) => `${prefix}function ${name}(${extractCppParamNames(params)}) {`);
}

function stripCppFunctionPrototypes(sourceText) {
  const src = String(sourceText || '');
  const protoRegex = /(^|\n)(\s*(?:static\s+)?(?:inline\s+)?(?:extern\s+)?(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:(?:std::)?string|int|void|float|double|char|bool)\s+\**\s*&?\s*[A-Za-z_]\w*\s*\([^{};]*\)\s*;)/gm;
  return src.replace(protoRegex, (full, prefix) => `${prefix}`);
}

function convertCppForDeclarations(sourceText) {
  return String(sourceText || '').replace(
    /\bfor\s*\(\s*(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:(?:std::)?string|int|float|double|char|bool|auto)\s+/g,
    'for (let '
  );
}

function convertCppDeclarations(sourceText) {
  const src = String(sourceText || '');
  const declRegex = /(^|[;\{\}\n]\s*)(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:(?:std::)?string|int|float|double|char|bool|auto)\b\s*([^;]+);/gm;
  return src.replace(declRegex, (full, prefix, body) => {
    const segment = String(body || '').trim();
    if (!segment) return full;
    if (/\bfunction\b/.test(segment)) return full;
    if (/[{}]/.test(segment)) return full;
    if (/^\**\s*&?\s*[A-Za-z_]\w*\s*\([^)]*\)\s*$/.test(segment)) return `${prefix}`; // function prototype fragment
    const parts = segment.split(',').map((partRaw) => {
      const p = String(partRaw || '');
      const lhs = p.split('=')[0];
      if (/\[[^\]]*\]/.test(lhs)) return null; // basic first: array declarations not handled here
      return p.replace(/^(\s*)[*&]+\s*/, '$1');
    });
    if (parts.some((p) => p == null)) return full;
    return `${prefix}let ${parts.join(',')};`;
  });
}

function replaceSimpleCppCasts(sourceText) {
  return String(sourceText || '').replace(
    /\(\s*(?:const\s+|volatile\s+|signed\s+|unsigned\s+|short\s+|long\s+)*(?:(?:std::)?string|int|float|double|char|bool|void)\s*(?:[*&]+\s*)?\)\s*/g,
    ''
  );
}

function normalizeCppCommonTokens(sourceText) {
  return String(sourceText || '')
    .replace(/\bnullptr\b/g, 'null')
    .replace(/\bNULL\b/g, 'null')
    .replace(/\btrue\b/g, 'true')
    .replace(/\bfalse\b/g, 'false');
}

function convertCppIostreamStatements(sourceText, typeHints) {
  const lines = String(sourceText || '').split('\n');
  const hintMap = typeHints instanceof Map ? typeHints : new Map();

  const getTypeHint = (expr) => {
    const e = String(expr || '').trim();
    const m = e.match(/^([A-Za-z_]\w*)$/);
    if (!m) return 'auto';
    return String(hintMap.get(String(m[1] || '')) || 'auto');
  };

  const convertCout = (rawLine) => {
    const line = String(rawLine || '');
    const semi = line.lastIndexOf(';');
    if (semi < 0) return line;
    const beforeSemi = line.slice(0, semi);
    const prefixMatch = beforeSemi.match(/^(\s*)(?:std::)?cout\s*<<(.*)$/);
    if (!prefixMatch) return line;
    const indent = String(prefixMatch[1] || '');
    const chain = String(prefixMatch[2] || '').trim();
    const parts = splitTopLevelOperator(chain, '<<');
    if (!parts.length) return line;
    const args = parts.map((partRaw) => {
      const part = String(partRaw || '').trim();
      if (!part) return '""';
      if (part === 'endl') return '__cpprt.endl';
      return part;
    });
    return `${indent}__cpprt.cout(${args.join(', ')});${line.slice(semi + 1)}`;
  };

  const convertCin = (rawLine) => {
    const line = String(rawLine || '');
    const semi = line.lastIndexOf(';');
    if (semi < 0) return line;
    const beforeSemi = line.slice(0, semi);
    const prefixMatch = beforeSemi.match(/^(\s*)(?:std::)?cin\s*>>(.*)$/);
    if (!prefixMatch) return line;
    const indent = String(prefixMatch[1] || '');
    const chain = String(prefixMatch[2] || '').trim();
    const targets = splitTopLevelOperator(chain, '>>');
    if (!targets.length) return line;
    const assigns = [];
    for (const targetRaw of targets) {
      const target = String(targetRaw || '').trim();
      if (!target) continue;
      if (!/^[A-Za-z_]\w*(?:\s*\[[^\]]+\])?$/.test(target)) {
        throw new MiniCppCompileError(`Unsupported cin target in basic C++ compiler: ${target}`, 1, 1, 'inbuilt-cpp:cin');
      }
      assigns.push(`${target} = __cpprt.readValue(${JSON.stringify(getTypeHint(target))})`);
    }
    return `${indent}(()=>{ ${assigns.join('; ')}; return 0; })();${line.slice(semi + 1)}`;
  };

  const convertGetline = (rawLine) => {
    const line = String(rawLine || '');
    return line.replace(
      /^(\s*)getline\s*\(\s*(?:std::)?cin\s*,\s*([A-Za-z_]\w*)\s*\)\s*;/,
      (_full, indent, name) => `${indent}${name} = __cpprt.readLine();`
    );
  };

  return lines.map((rawLine) => {
    let line = String(rawLine || '');
    line = convertGetline(line);
    line = convertCout(line);
    line = convertCin(line);
    return line;
  }).join('\n');
}

function transpileCppSubsetToJs(sourceText) {
  let out = stripCommentsPreserveLayout(sourceText);
  out = stripCppPreprocessorBasic(out);
  rejectUnsupportedCppSyntax(out);
  const typeHints = collectCppTypeHints(out);
  out = out.replace(/^\s*using\s+namespace\s+std\s*;\s*$/gm, '');
  out = out.replace(/^\s*using\s+std::[A-Za-z_]\w*\s*;\s*$/gm, '');
  out = out.replace(/\bstd::/g, '');
  out = convertCppIostreamStatements(out, typeHints);
  out = convertCppFunctionSignatures(out);
  out = stripCppFunctionPrototypes(out);
  out = convertCppForDeclarations(out);
  out = convertCppDeclarations(out);
  out = replaceSimpleCppCasts(out);
  out = normalizeCppCommonTokens(out);
  if (!/\bfunction\s+main\s*\(/.test(out)) {
    throw new MiniCppCompileError('Inbuilt C++ compiler requires a main() function', 1, 1, 'inbuilt-cpp:no-main');
  }
  return out;
}

function createMiniCppRuntime(options = {}) {
  let output = '';
  let bytes = 0;
  const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (128 * 1024 * 1024));
  const stdinText = String(options.stdin || options.stdinText || '');
  let stdinPos = 0;
  let outputTruncated = false;
  const endl = { __miniCppEndl: true };

  const appendChunkByBytes = (text, limitBytes) => {
    if (!text || limitBytes <= 0) return '';
    const buf = Buffer.from(String(text), 'utf8');
    if (buf.length <= limitBytes) return buf.toString('utf8');
    return buf.subarray(0, Math.max(0, limitBytes)).toString('utf8');
  };

  const append = (value) => {
    if (outputTruncated) return;
    const chunk = String(value ?? '');
    if (!chunk) return;
    const chunkBytes = Buffer.byteLength(chunk, 'utf8');
    if (bytes + chunkBytes > maxOutputBytes) {
      const remaining = Math.max(0, maxOutputBytes - bytes);
      const clipped = appendChunkByBytes(chunk, remaining);
      if (clipped) {
        output += clipped;
        bytes += Buffer.byteLength(clipped, 'utf8');
      }
      outputTruncated = true;
      return;
    }
    bytes += chunkBytes;
    output += chunk;
  };

  const skipWs = () => {
    while (stdinPos < stdinText.length && /\s/.test(stdinText.charAt(stdinPos))) stdinPos += 1;
  };

  const readToken = () => {
    skipWs();
    if (stdinPos >= stdinText.length) return null;
    const start = stdinPos;
    while (stdinPos < stdinText.length && !/\s/.test(stdinText.charAt(stdinPos))) stdinPos += 1;
    return stdinText.slice(start, stdinPos);
  };

  const readLine = () => {
    if (stdinPos >= stdinText.length) return '';
    if (stdinText.charAt(stdinPos) === '\n') stdinPos += 1;
    if (stdinText.charAt(stdinPos) === '\r') stdinPos += 1;
    const start = stdinPos;
    while (stdinPos < stdinText.length) {
      const ch = stdinText.charAt(stdinPos);
      if (ch === '\n' || ch === '\r') break;
      stdinPos += 1;
    }
    const line = stdinText.slice(start, stdinPos);
    if (stdinPos < stdinText.length && stdinText.charAt(stdinPos) === '\r') stdinPos += 1;
    if (stdinPos < stdinText.length && stdinText.charAt(stdinPos) === '\n') stdinPos += 1;
    return line;
  };

  const readValue = (typeHint) => {
    const token = readToken();
    if (token == null || token === '') {
      throw new MiniCppRuntimeError(
        'Program requested more input (cin >> ...) than provided. Provide all required stdin values and rerun.',
        1,
        1,
        'inbuilt-cpp:stdin-eof'
      );
    }
    const hint = String(typeHint || 'auto').toLowerCase();
    if (hint === 'string') return token;
    if (hint === 'char') return token ? token.charAt(0) : '\0';
    if (hint === 'bool') {
      if (/^(true|1)$/i.test(token)) return true;
      if (/^(false|0)$/i.test(token)) return false;
      return Boolean(token);
    }
    if (hint === 'int') {
      const n = Number.parseInt(token, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (hint === 'double') {
      const n = Number(token);
      return Number.isFinite(n) ? n : 0;
    }
    // auto/basic fallback: try numeric, else string
    if (/^[+-]?\d+$/.test(token)) return Number.parseInt(token, 10);
    if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(token)) return Number(token);
    return token;
  };

  const rt = {
    endl,
    cout(...parts) {
      for (const part of parts) {
        if (part && typeof part === 'object' && part.__miniCppEndl === true) {
          append('\n');
          continue;
        }
        if (typeof part === 'boolean') {
          append(part ? '1' : '0');
          continue;
        }
        append(String(part ?? ''));
      }
      return rt;
    },
    readValue,
    readLine,
    exit(code) {
      const n = Math.trunc(Number(code) || 0);
      throw new MiniCppRuntimeError(`Program exited with code ${n}`, 1, 1, 'inbuilt-cpp:exit');
    },
    getOutput() {
      return output;
    },
    isOutputTruncated() {
      return outputTruncated;
    }
  };
  return rt;
}

function buildExecutionScript(transpiledCpp) {
  const userCode = String(transpiledCpp || '');
  const prelude = [
    '"use strict";',
    'const __cpprt = globalThis.__miniCpprt;',
    'const endl = __cpprt.endl;',
    'const sqrt = (v) => Math.sqrt(Number(v) || 0);',
    'const pow = (a,b) => Math.pow(Number(a) || 0, Number(b) || 0);',
    'const sin = (v) => Math.sin(Number(v) || 0);',
    'const cos = (v) => Math.cos(Number(v) || 0);',
    'const tan = (v) => Math.tan(Number(v) || 0);',
    'const abs = (v) => Math.abs(Number(v) || 0);',
    'const fabs = (v) => Math.abs(Number(v) || 0);',
    'const floor = (v) => Math.floor(Number(v) || 0);',
    'const ceil = (v) => Math.ceil(Number(v) || 0);',
    'const round = (v) => Math.round(Number(v) || 0);',
    'const log = (v) => Math.log(Number(v) || 0);',
    'const log10 = (v) => (Math.log10 ? Math.log10(Number(v) || 0) : Math.log(Number(v) || 0) / Math.LN10);',
    'const exp = (v) => Math.exp(Number(v) || 0);',
    'const min = (...a) => Math.min(...a.map((v) => Number(v) || 0));',
    'const max = (...a) => Math.max(...a.map((v) => Number(v) || 0));',
    'const exit = (code) => __cpprt.exit(code);'
  ];
  return {
    code: [...prelude, userCode, 'globalThis.__miniCppRet = (typeof main === "function") ? main() : 0;'].join('\n'),
    wrapperPrefixLines: prelude.length
  };
}

function normalizeRuntimeExitCode(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.trunc(n);
}

function parseLocationFromErrorStack(error, sourcePath, wrapperPrefixLines = 0) {
  const stack = String(error?.stack || '');
  const safePath = String(sourcePath || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`${safePath}:(\\d+):(\\d+)`),
    /generated\.minicpp:(\d+):(\d+)/,
    /<anonymous>:(\d+):(\d+)/
  ];
  for (const re of patterns) {
    const m = stack.match(re);
    if (!m) continue;
    const line = Math.max(1, (Number(m[1]) || 1) - Number(wrapperPrefixLines || 0));
    const col = Math.max(1, Number(m[2]) || 1);
    return { line, col };
  }
  return { line: 1, col: 1 };
}

function makeDiag(line, col, message, code = 'inbuilt-cpp:compile', severity = 'error') {
  return [{
    line: Math.max(1, Number(line) || 1),
    col: Math.max(1, Number(col) || 1),
    severity: severity === 'warning' ? 'warning' : 'error',
    code: String(code || 'inbuilt-cpp:compile'),
    message: String(message || '')
  }];
}

async function runInbuiltCppProgram(options = {}) {
  const sourcePath = path.resolve(String(options.sourcePath || options.path || ''));
  const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (128 * 1024 * 1024));
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 120000);
  let sourceText = '';
  try {
    sourceText = await fs.promises.readFile(sourcePath, 'utf8');
  } catch (error) {
    const msg = `Could not read source file: ${error?.message || error}`;
    return {
      success: false,
      phase: 'compile',
      compiler: 'inbuilt-mini-cpp',
      compilerProfile: 'inbuilt',
      error: msg,
      diagnostics: makeDiag(1, 1, msg, 'inbuilt-cpp:io')
    };
  }

  let transpiled = '';
  try {
    transpiled = transpileCppSubsetToJs(sourceText);
  } catch (error) {
    const msg = String(error?.message || 'Inbuilt C++ compiler failed');
    return {
      success: false,
      phase: 'compile',
      compiler: 'inbuilt-mini-cpp',
      compilerProfile: 'inbuilt',
      error: msg,
      diagnostics: makeDiag(error?.line || 1, error?.col || 1, msg, error?.code || 'inbuilt-cpp:compile')
    };
  }

  const runtime = createMiniCppRuntime({
    stdin: options.stdin || options.stdinText || options.input || '',
    maxOutputBytes
  });
  const scriptBuild = buildExecutionScript(transpiled);
  const sandbox = {
    __miniCpprt: runtime,
    __miniCppRet: 0,
    Math,
    Number,
    String,
    Boolean,
    JSON
  };
  const context = vm.createContext(sandbox);
  try {
    const script = new vm.Script(scriptBuild.code, {
      filename: sourcePath || 'generated.minicpp',
      displayErrors: true
    });
    script.runInContext(context, { timeout: timeoutMs, displayErrors: true });
  } catch (error) {
    const loc = parseLocationFromErrorStack(error, sourcePath, scriptBuild.wrapperPrefixLines);
    const rawMsg = String(error?.message || error || 'Inbuilt C++ runtime failed');
    const isCompileLike = /Unexpected token|Unexpected identifier|missing \)|missing ]|Invalid or unexpected token|Function statements require|SyntaxError/i.test(rawMsg);
    const phase = (error instanceof MiniCppCompileError || isCompileLike) ? 'compile' : 'run';
    const code = phase === 'compile' ? 'inbuilt-cpp:compile' : 'inbuilt-cpp:runtime';
    const msg = phase === 'compile'
      ? `Inbuilt compiler supports a basic C++ subset (not full C++). ${rawMsg}`
      : rawMsg;
    return {
      success: false,
      phase,
      compiler: 'inbuilt-mini-cpp',
      compilerProfile: 'inbuilt',
      error: msg,
      diagnostics: makeDiag(loc.line, loc.col, msg, code),
      output: runtime.getOutput(),
      outputTruncated: runtime.isOutputTruncated() === true
    };
  }

  const output = String(runtime.getOutput() || '');
  const outputTruncated = runtime.isOutputTruncated() === true;
  const exitCode = normalizeRuntimeExitCode(context.__miniCppRet);
  return {
    success: exitCode === 0,
    phase: 'run',
    compiler: 'inbuilt-mini-cpp',
    compilerProfile: 'inbuilt',
    compilerCommand: 'inbuilt',
    compileOutput: 'Used Coder inbuilt C++ compiler (basic subset) because no system C++ compiler was available.',
    output,
    outputTruncated,
    diagnostics: [],
    exitCode,
    timedOut: false,
    error: exitCode === 0 ? '' : `Program exited with code ${exitCode}`
  };
}

module.exports = {
  runInbuiltCppProgram
};
