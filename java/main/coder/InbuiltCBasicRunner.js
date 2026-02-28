const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MiniCCompileError extends Error {
  constructor(message, line = 1, col = 1, code = 'inbuilt:compile') {
    super(String(message || 'Inbuilt C compile error'));
    this.name = 'MiniCCompileError';
    this.line = Math.max(1, Number(line) || 1);
    this.col = Math.max(1, Number(col) || 1);
    this.code = String(code || 'inbuilt:compile');
  }
}

class MiniCRuntimeError extends Error {
  constructor(message, line = 1, col = 1, code = 'inbuilt:runtime') {
    super(String(message || 'Inbuilt C runtime error'));
    this.name = 'MiniCRuntimeError';
    this.line = Math.max(1, Number(line) || 1);
    this.col = Math.max(1, Number(col) || 1);
    this.code = String(code || 'inbuilt:runtime');
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
      } else {
        out += ' ';
      }
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
      mode = (ch === '"') ? 'string' : 'char';
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function parseMiniCDefineDirective(rawLine, lineNo = 1) {
  const line = String(rawLine || '');
  const match = line.match(/^#\s*define\s+([A-Za-z_]\w*)(.*)$/i);
  if (!match) return null;
  const name = String(match[1] || '');
  const tail = String(match[2] || '');

  if (tail.trimStart().startsWith('(')) {
    const col = Math.max(1, line.indexOf(name) + 1);
    throw new MiniCCompileError(
      `Function-like macros are not supported in inbuilt compiler: #define ${name}(...)`,
      lineNo,
      col,
      'inbuilt:preprocessor'
    );
  }

  let value = '';
  if (tail) {
    const m = tail.match(/^\s+([\s\S]*)$/);
    value = m ? String(m[1] || '') : '';
  }

  return { name, value };
}

function expandMiniCObjectMacros(sourceText, macros, maxPasses = 8) {
  const src = String(sourceText || '');
  if (!macros || !(macros instanceof Map) || macros.size === 0) return src;

  const replaceOnce = (input) => {
    const text = String(input || '');
    let out = '';
    let i = 0;
    let mode = 'code';
    let quote = '';
    let changed = false;

    while (i < text.length) {
      const ch = text.charAt(i);

      if (mode === 'string' || mode === 'char') {
        out += ch;
        if (ch === '\\') {
          const esc = text.charAt(i + 1);
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

      if (ch === '"' || ch === "'") {
        mode = (ch === '"') ? 'string' : 'char';
        quote = ch;
        out += ch;
        i += 1;
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < text.length && /[A-Za-z0-9_]/.test(text.charAt(j))) j += 1;
        const ident = text.slice(i, j);
        if (macros.has(ident)) {
          out += String(macros.get(ident) || '');
          changed = true;
        } else {
          out += ident;
        }
        i = j;
        continue;
      }

      out += ch;
      i += 1;
    }

    return { text: out, changed };
  };

  let out = src;
  for (let pass = 0; pass < Math.max(1, Number(maxPasses) || 1); pass += 1) {
    const next = replaceOnce(out);
    out = next.text;
    if (!next.changed) break;
  }
  return out;
}

function parseMiniCPreprocessorNumericValue(rawValue, macros) {
  const expanded = expandMiniCObjectMacros(String(rawValue || ''), macros).trim();
  if (!expanded) return 1;
  if (/^[+-]?\d+$/.test(expanded)) return Number.parseInt(expanded, 10) || 0;
  if (/^[+-]?0x[0-9a-fA-F]+$/.test(expanded)) return Number.parseInt(expanded, 16) || 0;
  if (/^[+-]?0[0-7]+$/.test(expanded)) return Number.parseInt(expanded, 8) || 0;
  const asNum = Number(expanded);
  if (Number.isFinite(asNum)) return asNum;
  return 0;
}

function evaluateMiniCPreprocessorExpr(rawExpr, macros, lineNo = 1) {
  const expr = String(rawExpr || '').trim();
  if (!expr) return false;
  let jsExpr = expr;

  jsExpr = jsExpr.replace(/\bdefined\s*\(\s*([A-Za-z_]\w*)\s*\)/g, (_m, name) => (
    macros.has(String(name || '')) ? '1' : '0'
  ));
  jsExpr = jsExpr.replace(/\bdefined\s+([A-Za-z_]\w*)\b/g, (_m, name) => (
    macros.has(String(name || '')) ? '1' : '0'
  ));

  jsExpr = jsExpr.replace(/\b([A-Za-z_]\w*)\b/g, (full, ident) => {
    const name = String(ident || '');
    if (name === 'true') return '1';
    if (name === 'false') return '0';
    if (!macros.has(name)) return '0';
    const value = parseMiniCPreprocessorNumericValue(macros.get(name), macros);
    return Number.isFinite(value) ? String(value) : '0';
  });

  if (/[^0-9a-fA-FxX+\-*/%<>=!&|^~()?:.,\s]/.test(jsExpr)) {
    throw new MiniCCompileError(
      `Unsupported #if expression in inbuilt compiler: ${expr}`,
      lineNo,
      1,
      'inbuilt:preprocessor'
    );
  }

  if (/(^|[^=!<>])=($|[^=])/.test(jsExpr)) {
    throw new MiniCCompileError(
      `Assignments are not allowed in #if expressions: ${expr}`,
      lineNo,
      1,
      'inbuilt:preprocessor'
    );
  }

  try {
    const value = vm.runInNewContext(`(${jsExpr})`, Object.create(null), { timeout: 20 });
    return Boolean(Number(value) ? 1 : 0);
  } catch (error) {
    throw new MiniCCompileError(
      `Invalid #if expression in inbuilt compiler: ${expr}`,
      lineNo,
      1,
      'inbuilt:preprocessor'
    );
  }
}

function normalizePreprocessorLines(sourceText) {
  const src = String(sourceText || '');
  const lines = src.split('\n');
  const out = [];
  const macros = new Map();
  const condStack = [];
  const isActive = () => condStack.every((f) => f && f.active === true);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || '');
    const trimmed = raw.trim();
    const active = isActive();
    if (!trimmed.startsWith('#')) {
      out.push(active ? expandMiniCObjectMacros(raw, macros) : '');
      continue;
    }

    if (/^#\s*if(?:def|ndef)?\b/i.test(trimmed)) {
      if (/^#\s*ifdef\b/i.test(trimmed)) {
        const m = trimmed.match(/^#\s*ifdef\s+([A-Za-z_]\w*)\s*$/i);
        if (!m) {
          throw new MiniCCompileError('Invalid #ifdef directive in inbuilt compiler', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
        }
        const cond = macros.has(String(m[1] || ''));
        condStack.push({ parentActive: active, active: Boolean(active && cond), anyMatched: Boolean(active && cond), elseSeen: false });
        out.push('');
        continue;
      }
      if (/^#\s*ifndef\b/i.test(trimmed)) {
        const m = trimmed.match(/^#\s*ifndef\s+([A-Za-z_]\w*)\s*$/i);
        if (!m) {
          throw new MiniCCompileError('Invalid #ifndef directive in inbuilt compiler', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
        }
        const cond = !macros.has(String(m[1] || ''));
        condStack.push({ parentActive: active, active: Boolean(active && cond), anyMatched: Boolean(active && cond), elseSeen: false });
        out.push('');
        continue;
      }
      const expr = trimmed.replace(/^#\s*if\b/i, '').trim();
      const cond = evaluateMiniCPreprocessorExpr(expr, macros, i + 1);
      condStack.push({ parentActive: active, active: Boolean(active && cond), anyMatched: Boolean(active && cond), elseSeen: false });
      out.push('');
      continue;
    }

    if (/^#\s*elif\b/i.test(trimmed)) {
      const top = condStack[condStack.length - 1];
      if (!top) {
        throw new MiniCCompileError('#elif without matching #if', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
      }
      if (top.elseSeen) {
        throw new MiniCCompileError('#elif after #else is not allowed', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
      }
      const expr = trimmed.replace(/^#\s*elif\b/i, '').trim();
      const cond = top.parentActive && !top.anyMatched && evaluateMiniCPreprocessorExpr(expr, macros, i + 1);
      top.active = Boolean(cond);
      if (cond) top.anyMatched = true;
      out.push('');
      continue;
    }

    if (/^#\s*else\b/i.test(trimmed)) {
      const top = condStack[condStack.length - 1];
      if (!top) {
        throw new MiniCCompileError('#else without matching #if', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
      }
      if (top.elseSeen) {
        throw new MiniCCompileError('Duplicate #else in preprocessor block', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
      }
      top.elseSeen = true;
      top.active = Boolean(top.parentActive && !top.anyMatched);
      if (top.active) top.anyMatched = true;
      out.push('');
      continue;
    }

    if (/^#\s*endif\b/i.test(trimmed)) {
      if (!condStack.length) {
        throw new MiniCCompileError('#endif without matching #if', i + 1, Math.max(1, raw.indexOf('#') + 1), 'inbuilt:preprocessor');
      }
      condStack.pop();
      out.push('');
      continue;
    }

    if (!active) {
      out.push('');
      continue;
    }

    if (/^#\s*include\b/i.test(trimmed)) {
      out.push('');
      continue;
    }
    if (/^#\s*(pragma|line)\b/i.test(trimmed)) {
      out.push('');
      continue;
    }
    if (/^#\s*define\b/i.test(trimmed)) {
      const parsed = parseMiniCDefineDirective(trimmed, i + 1);
      if (!parsed) {
        const col = Math.max(1, raw.indexOf('#') + 1);
        throw new MiniCCompileError('Invalid #define directive in inbuilt compiler', i + 1, col, 'inbuilt:preprocessor');
      }
      macros.set(parsed.name, parsed.value);
      out.push('');
      continue;
    }
    if (/^#\s*undef\b/i.test(trimmed)) {
      const m = trimmed.match(/^#\s*undef\s+([A-Za-z_]\w*)\s*$/i);
      if (!m) {
        const col = Math.max(1, raw.indexOf('#') + 1);
        throw new MiniCCompileError('Invalid #undef directive in inbuilt compiler', i + 1, col, 'inbuilt:preprocessor');
      }
      macros.delete(String(m[1] || ''));
      out.push('');
      continue;
    }
    if (/^#\s*error\b/i.test(trimmed)) {
      const msg = trimmed.replace(/^#\s*error\b/i, '').trim();
      throw new MiniCCompileError(
        `#error: ${msg || 'Preprocessor error'}`,
        i + 1,
        Math.max(1, raw.indexOf('#') + 1),
        'inbuilt:preprocessor'
      );
    }

    throw new MiniCCompileError(
      `Unsupported preprocessor directive in inbuilt compiler: ${trimmed.split(/\s+/).slice(0, 2).join(' ')}`,
      i + 1,
      Math.max(1, raw.indexOf('#') + 1),
      'inbuilt:preprocessor'
    );
  }
  if (condStack.length) {
    throw new MiniCCompileError('Unclosed preprocessor conditional block (#if/#ifdef/#ifndef)', lines.length, 1, 'inbuilt:preprocessor');
  }
  return out.join('\n');
}

function charLiteralToNumber(rawLiteral, line, col) {
  const text = String(rawLiteral || '');
  if (!text.startsWith("'") || !text.endsWith("'")) {
    throw new MiniCCompileError('Invalid character literal', line, col, 'inbuilt:char-literal');
  }
  const body = text.slice(1, -1);
  if (!body) throw new MiniCCompileError('Empty character literal is not supported', line, col, 'inbuilt:char-literal');
  if (body.length === 1) return String(body.charCodeAt(0));
  if (body.charAt(0) !== '\\') {
    throw new MiniCCompileError('Multi-character character literals are not supported in inbuilt compiler', line, col, 'inbuilt:char-literal');
  }

  if (body.length === 2) {
    const esc = body.charAt(1);
    const map = {
      n: 10,
      r: 13,
      t: 9,
      0: 0,
      '\\': 92,
      "'": 39,
      '"': 34,
      b: 8,
      f: 12,
      v: 11
    };
    if (Object.prototype.hasOwnProperty.call(map, esc)) return String(map[esc]);
  }

  if (/^\\x[0-9a-fA-F]{1,2}$/.test(body)) {
    return String(parseInt(body.slice(2), 16));
  }
  if (/^\\[0-7]{1,3}$/.test(body)) {
    return String(parseInt(body.slice(1), 8));
  }

  throw new MiniCCompileError(`Unsupported character escape ${text}`, line, col, 'inbuilt:char-literal');
}

function replaceCharLiteralsPreserveLines(sourceText) {
  const src = String(sourceText || '');
  let out = '';
  let i = 0;
  let mode = 'code';
  let quote = '';

  while (i < src.length) {
    const ch = src.charAt(i);
    if (mode === 'string') {
      out += ch;
      if (ch === '\\') {
        const esc = src.charAt(i + 1);
        if (esc) {
          out += esc;
          i += 2;
          continue;
        }
      }
      if (ch === '"') mode = 'code';
      i += 1;
      continue;
    }

    if (ch === '"') {
      mode = 'string';
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "'") {
      const start = i;
      let j = i + 1;
      let closed = false;
      while (j < src.length) {
        const c = src.charAt(j);
        if (c === '\n') break;
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === "'") {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      const loc = indexToLineCol(src, start);
      if (!closed) {
        throw new MiniCCompileError('Unterminated character literal', loc.line, loc.col, 'inbuilt:char-literal');
      }
      const literal = src.slice(start, j);
      out += charLiteralToNumber(literal, loc.line, loc.col);
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function findUnsupportedPattern(text, regex, message, code) {
  const src = String(text || '');
  const m = regex.exec(src);
  if (!m) return null;
  const idx = Number.isFinite(m.index) ? m.index : src.indexOf(m[0]);
  const loc = indexToLineCol(src, idx);
  return new MiniCCompileError(message, loc.line, loc.col, code);
}

function rejectUnsupportedSyntax(sourceText) {
  const src = String(sourceText || '');
  const checks = [
    { re: /\b(?:struct|union|enum|typedef)\b/, msg: 'struct/union/enum/typedef are not supported by inbuilt compiler yet', code: 'inbuilt:unsupported-type' },
    { re: /\bgoto\b/, msg: 'goto is not supported by inbuilt compiler yet', code: 'inbuilt:unsupported-flow' },
    { re: /\b(?:gets|fread|fwrite|system)\b/, msg: 'Some advanced file/system APIs are not supported by inbuilt compiler yet', code: 'inbuilt:unsupported-api' },
    { re: /->/, msg: 'Struct pointer access (->) is not supported by inbuilt compiler yet', code: 'inbuilt:unsupported-pointer' }
  ];
  for (const check of checks) {
    const err = findUnsupportedPattern(src, new RegExp(check.re.source, check.re.flags), check.msg, check.code);
    if (err) throw err;
  }
}

function splitTopLevelCsv(text) {
  const src = String(text || '');
  const parts = [];
  let start = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let mode = 'code';
  let quote = '';
  let i = 0;

  while (i < src.length) {
    const ch = src.charAt(i);
    if (mode === 'string' || mode === 'char') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        mode = 'code';
        quote = '';
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      mode = (ch === '"') ? 'string' : 'char';
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === ',' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  parts.push(src.slice(start));
  return parts;
}

function parseMiniCScanDestination(rawDest, sourceText, offset) {
  let dest = String(rawDest || '').trim();
  if (!dest) {
    const loc = indexToLineCol(sourceText, offset);
    throw new MiniCCompileError('Invalid scanf/fscanf destination', loc.line, loc.col, 'inbuilt:scanf');
  }
  if (dest.startsWith('&')) dest = dest.slice(1).trim();
  if (!dest) {
    const loc = indexToLineCol(sourceText, offset);
    throw new MiniCCompileError('Invalid scanf/fscanf destination after &', loc.line, loc.col, 'inbuilt:scanf');
  }
  if (/->/.test(dest) || /\*/.test(dest)) {
    const loc = indexToLineCol(sourceText, offset);
    throw new MiniCCompileError('scanf/fscanf destination must be a variable or array element in inbuilt compiler', loc.line, loc.col, 'inbuilt:scanf');
  }
  if (!/^[A-Za-z_]\w*(?:\s*\[[^\]]+\])?$/.test(dest)) {
    const loc = indexToLineCol(sourceText, offset);
    throw new MiniCCompileError(`Unsupported scanf/fscanf destination: ${dest}`, loc.line, loc.col, 'inbuilt:scanf');
  }
  return dest;
}

function replaceScanfFamilyCalls(sourceText) {
  const src = String(sourceText || '');
  const names = new Set(['scanf', 'fscanf']);
  let out = '';
  let i = 0;
  let mode = 'code';
  let quote = '';

  const parseCall = (openIndex) => {
    let j = openIndex + 1;
    let d = 1;
    let innerMode = 'code';
    let innerQuote = '';
    while (j < src.length) {
      const ch = src.charAt(j);
      if (innerMode === 'string' || innerMode === 'char') {
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === innerQuote) {
          innerMode = 'code';
          innerQuote = '';
        }
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        innerMode = (ch === '"') ? 'string' : 'char';
        innerQuote = ch;
        j += 1;
        continue;
      }
      if (ch === '(') d += 1;
      else if (ch === ')') {
        d -= 1;
        if (d === 0) return j;
      }
      j += 1;
    }
    return -1;
  };

  while (i < src.length) {
    const ch = src.charAt(i);
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
    if (ch === '"' || ch === "'") {
      out += ch;
      mode = (ch === '"') ? 'string' : 'char';
      quote = ch;
      i += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src.charAt(j))) j += 1;
      const name = src.slice(i, j);
      if (names.has(name) && !/[A-Za-z0-9_]/.test(src.charAt(i - 1) || '')) {
        let k = j;
        while (k < src.length && /\s/.test(src.charAt(k))) k += 1;
        if (src.charAt(k) === '(') {
          const closeIndex = parseCall(k);
          if (closeIndex < 0) {
            const loc = indexToLineCol(src, i);
            throw new MiniCCompileError(`Unterminated ${name}() call`, loc.line, loc.col, 'inbuilt:scanf');
          }
          const argsText = src.slice(k + 1, closeIndex);
          const args = splitTopLevelCsv(argsText).map((v) => String(v || '').trim()).filter((v, idx, arr) => idx < arr.length || v);
          if (name === 'scanf') {
            if (args.length >= 2) {
              const fmt = args[0];
              const setters = args.slice(1).map((destRaw, idx) => {
                const dest = parseMiniCScanDestination(destRaw, src, i + idx);
                return `(__v)=>((Array.isArray(${dest}) ? (__rt.writeCString(${dest}, __v), 1) : (${dest} = __v)), 1)`;
              });
              out += `__rt.scanfAssign(${fmt}${setters.length ? `, ${setters.join(', ')}` : ''})`;
              i = closeIndex + 1;
              continue;
            }
          } else if (name === 'fscanf') {
            if (args.length >= 3) {
              const fileExpr = args[0];
              const fmt = args[1];
              const setters = args.slice(2).map((destRaw, idx) => {
                const dest = parseMiniCScanDestination(destRaw, src, i + idx);
                return `(__v)=>((Array.isArray(${dest}) ? (__rt.writeCString(${dest}, __v), 1) : (${dest} = __v)), 1)`;
              });
              out += `__rt.fscanfAssign(${fileExpr}, ${fmt}${setters.length ? `, ${setters.join(', ')}` : ''})`;
              i = closeIndex + 1;
              continue;
            }
          }
        }
      }
      out += name;
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function parseMiniCStrtodArgs(arg1Text, arg2Text) {
  const a1 = String(arg1Text || '').trim();
  const a2 = String(arg2Text || '').trim();
  const m1 = a1.match(/^&\s*([A-Za-z_]\w*)\s*\[\s*([\s\S]+)\s*\]$/);
  if (!m1) return null;
  const baseName = String(m1[1] || '').trim();
  const indexExpr = String(m1[2] || '').trim();
  if (!baseName || !indexExpr) return null;
  const m2 = a2.match(/^(?:\(\s*char\s*\*\*\s*\)\s*)?&\s*([A-Za-z_]\w*)\s*$/i);
  if (!m2) return null;
  const targetName = String(m2[1] || '').trim();
  const castToCharPtrPtr = /^\s*\(\s*char\s*\*\*\s*\)/i.test(a2);
  return {
    baseName,
    indexExpr,
    targetName,
    castToCharPtrPtr
  };
}

function replaceStrtodCalls(sourceText) {
  const src = String(sourceText || '');
  let out = '';
  let i = 0;
  let mode = 'code';
  let quote = '';

  const parseCallClose = (openIndex) => {
    let j = openIndex + 1;
    let depth = 1;
    let innerMode = 'code';
    let innerQuote = '';
    while (j < src.length) {
      const ch = src.charAt(j);
      if (innerMode === 'string' || innerMode === 'char') {
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === innerQuote) {
          innerMode = 'code';
          innerQuote = '';
        }
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        innerMode = (ch === '"') ? 'string' : 'char';
        innerQuote = ch;
        j += 1;
        continue;
      }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) return j;
      }
      j += 1;
    }
    return -1;
  };

  while (i < src.length) {
    const ch = src.charAt(i);
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
    if (ch === '"' || ch === "'") {
      out += ch;
      mode = (ch === '"') ? 'string' : 'char';
      quote = ch;
      i += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src.charAt(j))) j += 1;
      const name = src.slice(i, j);
      if (name === 'strtod' && !/[A-Za-z0-9_]/.test(src.charAt(i - 1) || '')) {
        let k = j;
        while (k < src.length && /\s/.test(src.charAt(k))) k += 1;
        if (src.charAt(k) === '(') {
          const closeIndex = parseCallClose(k);
          if (closeIndex < 0) {
            const loc = indexToLineCol(src, i);
            throw new MiniCCompileError('Unterminated strtod() call', loc.line, loc.col, 'inbuilt:strtod');
          }
          const args = splitTopLevelCsv(src.slice(k + 1, closeIndex)).map((v) => String(v || '').trim());
          if (args.length >= 2) {
            const parsed = parseMiniCStrtodArgs(args[0], args[1]);
            if (parsed) {
              const setterExpr = parsed.castToCharPtrPtr
                ? `(__p)=>(${parsed.targetName} = __rt.ptrSlice(${parsed.targetName}, __p))`
                : `(__p)=>(${parsed.targetName} = __p)`;
              out += `__rt.strtodAt(${parsed.baseName}, ${parsed.indexExpr}, ${setterExpr})`;
              i = closeIndex + 1;
              continue;
            }
          }
        }
      }
      out += name;
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function replacePointerDifferenceAssignments(sourceText) {
  const src = String(sourceText || '');
  return src.replace(
    /(^|[;\{\}\n]\s*)([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*-\s*([A-Za-z_]\w*)\s*;/gm,
    (full, prefix, lhs, a, b) => `${prefix}${lhs} = __rt.ptrDiff(${a}, ${b});`
  );
}

function resolveMiniCTypeSize(typeText) {
  const t = String(typeText || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return 4;
  if (/\bchar\b/.test(t) || /\bbool\b/.test(t)) return 1;
  if (/\bshort\b/.test(t)) return 2;
  if (/\bdouble\b/.test(t)) return 8;
  if (/\blong\b/.test(t)) return 8;
  if (/\bsize_t\b/.test(t)) return 8;
  if (/\bfloat\b/.test(t)) return 4;
  return 4;
}

function convertSizeofExpressions(sourceText) {
  let out = String(sourceText || '');
  out = out.replace(/\bsizeof\s*\(\s*((?:(?:unsigned|signed|short|long)\s+)*(?:int|float|double|char|bool|size_t))\s*\)/gi, (full, typeExpr) => {
    return String(resolveMiniCTypeSize(typeExpr));
  });
  out = out.replace(/\bsizeof\s*\(\s*([A-Za-z_]\w*(?:\s*\[[^\]]+\])?)\s*\)/g, (full, expr) => {
    return `__rt.sizeof(${expr})`;
  });
  return out;
}

function convertArrayDeclarations(sourceText) {
  const src = String(sourceText || '');
  const arrayDeclRegex = /(^|[;\{\}\n]\s*)(?:const\s+)?((?:(?:unsigned|signed|short|long)\s+)*)((?:int|float|double|char|bool))\b\s+([A-Za-z_]\w*)\s*\[\s*([^\]\n]*)\s*\]\s*(?:=\s*([^;\n]+))?\s*;/gm;
  return src.replace(arrayDeclRegex, (full, prefix, quals, baseType, name, sizeExpr, initExpr, offset) => {
    const typeText = `${String(quals || '')}${String(baseType || '')}`.trim();
    const typeSize = resolveMiniCTypeSize(typeText);
    const sizeText = String(sizeExpr || '').trim();
    const initText = String(initExpr || '').trim();
    const isCharArray = /\bchar\b/i.test(typeText);
    if (initText) {
      if (isCharArray && /^"(?:\\.|[^"])*"$/.test(initText)) {
        if (sizeText) {
          return `${prefix}let ${name} = __rt.charBufferFromString(${initText}, ${sizeText});`;
        }
        return `${prefix}let ${name} = __rt.charBufferFromString(${initText});`;
      }
      if (/^\{[\s\S]*\}$/.test(initText)) {
        const inner = initText.slice(1, -1).trim();
        const jsArrayExpr = `[${inner}]`;
        const sizeArg = sizeText ? sizeText : 'undefined';
        return `${prefix}let ${name} = __rt.arrayFromInit(${jsArrayExpr}, ${sizeArg}, ${typeSize});`;
      }
      const loc = indexToLineCol(src, Number(offset) + String(prefix || '').length);
      throw new MiniCCompileError('Unsupported array initializer in inbuilt compiler (use string literal or { ... })', loc.line, loc.col, 'inbuilt:unsupported-array');
    }
    if (!sizeText) {
      const loc = indexToLineCol(src, Number(offset) + String(prefix || '').length);
      throw new MiniCCompileError('Array declarations without a size require an initializer in inbuilt compiler', loc.line, loc.col, 'inbuilt:unsupported-array');
    }
    return `${prefix}let ${name} = __rt.makeArray(${sizeText}, ${typeSize});`;
  });
}

function extractParamNames(paramText) {
  const raw = String(paramText || '').trim();
  if (!raw || raw === 'void') return '';
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.map((part, idx) => {
    let t = part;
    t = t.replace(/\b(?:const|volatile|register|static|extern)\b/g, ' ');
    t = t.replace(/\b(?:unsigned|signed|short|long|int|float|double|char|void|bool|FILE|size_t)\b/g, ' ');
    t = t.replace(/\[[^\]]*\]/g, ' ');
    const m = t.match(/([A-Za-z_]\w*)\s*$/);
    return m ? m[1] : `arg${idx}`;
  }).join(', ');
}

function convertFunctionSignatures(sourceText) {
  const src = String(sourceText || '');
  const fnRegex = /(^|[;\}\n]\s*)(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:int|void|float|double|char|bool|FILE|size_t)\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*\{/gm;
  return src.replace(fnRegex, (full, prefix, name, params) => {
    const paramNames = extractParamNames(params);
    return `${prefix}function ${name}(${paramNames}) {`;
  });
}

function stripFunctionPrototypes(sourceText) {
  const src = String(sourceText || '');
  const protoRegex = /(^|\n)(\s*(?:static\s+)?(?:inline\s+)?(?:extern\s+)?(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:int|void|float|double|char|bool|FILE|size_t)\s+\**\s*[A-Za-z_]\w*\s*\([^{};]*\)\s*;)/gm;
  return src.replace(protoRegex, (full, prefix) => `${prefix}`);
}

function convertForDeclarations(sourceText) {
  const src = String(sourceText || '');
  return src.replace(
    /\bfor\s*\(\s*(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:int|float|double|char|bool|size_t)\s+/g,
    'for (let '
  );
}

function convertLocalDeclarations(sourceText) {
  const src = String(sourceText || '');
  const declRegex = /(^|[;\{\}\n]\s*)(?:const\s+)?(?:(?:unsigned|signed|short|long)\s+)*(?:int|float|double|char|bool|FILE|size_t)\b\s*([^;]+);/gm;
  return src.replace(declRegex, (full, prefix, body) => {
    const segment = String(body || '').trim();
    if (!segment) return full;
    if (/\bfunction\b/.test(segment)) return full;
    if (/[{}]/.test(segment)) return full;
    if (/\(\s*\*\s*[A-Za-z_]\w*\s*\)/.test(segment)) return full;
    if (/^\**\s*[A-Za-z_]\w*\s*\([^)]*\)\s*$/.test(segment)) return `${prefix}`;
    const parts = splitTopLevelCsv(segment).map((part) => {
      const p = String(part || '');
      const lhs = p.split('=')[0];
      if (/\[[^\]]*\]/.test(lhs)) return null;
      return p.replace(/^(\s*)\*+\s*/, '$1');
    });
    if (parts.some((part) => part == null)) return full;
    return `${prefix}let ${parts.join(',')};`;
  });
}

function replaceSimpleCCasts(sourceText) {
  const src = String(sourceText || '');
  let out = src;
  // Drop common C casts after declarations/signatures are normalized. This is a semantic approximation,
  // but it keeps the generated JS valid for a broad set of C subset programs.
  out = out.replace(
    /\(\s*(?:const\s+|volatile\s+|signed\s+|unsigned\s+|short\s+|long\s+)*(?:int|float|double|char|bool|void|size_t|FILE)\s*(?:\*+\s*)?\)\s*/g,
    ''
  );
  return out;
}

function normalizeCommonCTokens(sourceText) {
  return String(sourceText || '')
    .replace(/\bNULL\b/g, '0')
    .replace(/\bEOF\b/g, '-1')
    .replace(/\bSEEK_SET\b/g, '0')
    .replace(/\bSEEK_CUR\b/g, '1')
    .replace(/\bSEEK_END\b/g, '2')
    .replace(/\bRAND_MAX\b/g, '2147483647')
    .replace(/\bM_PI\b/g, '3.141592653589793')
    .replace(/\btrue\b/g, 'true')
    .replace(/\bfalse\b/g, 'false');
}

function ensureMainFunctionExists(jsLikeText) {
  if (!/\bfunction\s+main\s*\(/.test(String(jsLikeText || ''))) {
    throw new MiniCCompileError('Inbuilt compiler requires a main() function', 1, 1, 'inbuilt:no-main');
  }
}

function transpileCSubsetToJs(sourceText) {
  const noComments = stripCommentsPreserveLayout(sourceText);
  const noPre = normalizePreprocessorLines(noComments);
  rejectUnsupportedSyntax(noPre);
  let out = replaceScanfFamilyCalls(noPre);
  out = replaceStrtodCalls(out);
  out = replacePointerDifferenceAssignments(out);
  out = convertSizeofExpressions(out);
  out = replaceCharLiteralsPreserveLines(out);
  out = normalizeCommonCTokens(out);
  out = convertArrayDeclarations(out);
  out = convertFunctionSignatures(out);
  out = stripFunctionPrototypes(out);
  out = convertForDeclarations(out);
  out = convertLocalDeclarations(out);
  out = replaceSimpleCCasts(out);
  ensureMainFunctionExists(out);
  return out;
}

function parseLocationFromErrorStack(error, sourcePath, wrapperPrefixLines = 0) {
  const stack = String(error?.stack || '');
  const safePath = String(sourcePath || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`${safePath}:(\\d+):(\\d+)`),
    /generated\.minic:(\d+):(\d+)/,
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

function getMiniCArrayMeta(arr) {
  if (!Array.isArray(arr)) return null;
  const meta = arr.__miniCMeta;
  if (!meta || typeof meta !== 'object') return null;
  return meta;
}

function setMiniCArrayMeta(arr, meta = {}) {
  if (!Array.isArray(arr)) return arr;
  try {
    Object.defineProperty(arr, '__miniCMeta', {
      value: {
        elemSize: Math.max(1, Number(meta.elemSize) || 1)
      },
      configurable: true,
      enumerable: false,
      writable: true
    });
  } catch (_) {
    arr.__miniCMeta = { elemSize: Math.max(1, Number(meta.elemSize) || 1) };
  }
  return arr;
}

function miniCStringFromValue(value) {
  if (Array.isArray(value)) {
    let out = '';
    for (let i = 0; i < value.length; i += 1) {
      const raw = value[i];
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n)) break;
      if (n === 0) break;
      out += String.fromCharCode(n & 0xFF);
    }
    return out;
  }
  if (value == null) return '';
  return String(value);
}

function miniCWriteCString(target, rawValue, maxChars) {
  if (!Array.isArray(target)) return String(rawValue ?? '');
  const text = miniCStringFromValue(rawValue);
  const limit = (maxChars === undefined || maxChars === null)
    ? Math.max(1, Number(target.length) || (text.length + 1))
    : Math.max(0, Math.trunc(Number(maxChars) || 0));
  const size = limit > 0 ? limit : Math.max(1, Number(target.length) || 1);
  if (target.length < size) target.length = size;
  for (let i = 0; i < size; i += 1) target[i] = 0;
  const maxWrite = Math.max(0, size - 1);
  for (let i = 0; i < text.length && i < maxWrite; i += 1) {
    target[i] = text.charCodeAt(i) & 0xFF;
  }
  if (!getMiniCArrayMeta(target)) setMiniCArrayMeta(target, { elemSize: 1 });
  return target;
}

function makeMiniCArray(length, elemSize = 1) {
  const len = Math.max(0, Math.trunc(Number(length) || 0));
  const arr = new Array(len).fill(0);
  return setMiniCArrayMeta(arr, { elemSize });
}

function miniCArrayFromInit(values, size, elemSize = 1) {
  const src = Array.isArray(values) ? values.slice() : [];
  const targetLen = (size === undefined || size === null || size === '')
    ? src.length
    : Math.max(0, Math.trunc(Number(size) || 0));
  const arr = makeMiniCArray(targetLen, elemSize);
  const count = Math.min(arr.length, src.length);
  for (let i = 0; i < count; i += 1) {
    arr[i] = src[i];
  }
  return arr;
}

function miniCCharBufferFromString(value, size) {
  const text = miniCStringFromValue(value);
  const needed = text.length + 1;
  const len = (size === undefined || size === null || size === '')
    ? needed
    : Math.max(1, Math.trunc(Number(size) || needed));
  const arr = makeMiniCArray(len, 1);
  miniCWriteCString(arr, text, len);
  return arr;
}

function formatPrintfValue(spec, arg) {
  const token = String(spec || '');
  const kind = token.charAt(token.length - 1).toLowerCase();
  const precisionMatch = token.match(/\.(\d+)/);
  const precision = precisionMatch ? Math.max(0, Number(precisionMatch[1]) || 0) : null;

  if (kind === 'd' || kind === 'i' || kind === 'u') {
    const n = Number(arg || 0);
    if (!Number.isFinite(n)) return '0';
    if (kind === 'u') return String((Math.trunc(n) >>> 0));
    return String(Math.trunc(n));
  }
  if (kind === 'f' || kind === 'g' || kind === 'e') {
    const n = Number(arg || 0);
    if (!Number.isFinite(n)) return '0';
    if (kind === 'e') {
      if (precision != null) return n.toExponential(precision);
      return n.toExponential();
    }
    if (precision != null) return n.toFixed(precision);
    return String(n);
  }
  if (kind === 'x' || kind === 'o') {
    const n = Math.trunc(Number(arg || 0));
    if (!Number.isFinite(n)) return '0';
    return (kind === 'x' ? (n >>> 0).toString(16) : (n >>> 0).toString(8));
  }
  if (kind === 'c') {
    if (Array.isArray(arg)) {
      const first = Number(arg[0] || 0);
      return Number.isFinite(first) ? String.fromCharCode(Math.trunc(first) & 0xFF) : '';
    }
    if (typeof arg === 'number') return String.fromCharCode(Math.trunc(arg));
    const s = String(arg ?? '');
    return s ? s.charAt(0) : '';
  }
  if (kind === 's') {
    return miniCStringFromValue(arg);
  }
  return String(arg ?? '');
}

function createMiniCRuntime(options = {}) {
  let output = '';
  let bytes = 0;
  const maxOutputBytes = Math.max(2048, Number(options.maxOutputBytes) || (256 * 1024));
  const stdinText = String(options.stdin || options.stdinText || '');
  const workingDir = path.resolve(String(options.workingDir || process.cwd()));
  let nextFileId = 1;
  const fileHandles = new Map();
  const stdinState = { content: stdinText, pos: 0 };

  const stdinHandle = { __miniCStdHandle: 'stdin' };
  const stdoutHandle = { __miniCStdHandle: 'stdout' };
  const stderrHandle = { __miniCStdHandle: 'stderr' };

  const append = (text) => {
    const chunk = String(text ?? '');
    if (!chunk) return;
    bytes += Buffer.byteLength(chunk, 'utf8');
    if (bytes > maxOutputBytes) {
      throw new MiniCRuntimeError('Inbuilt C output exceeded limit', 1, 1, 'inbuilt:output-limit');
    }
    output += chunk;
  };

  const toCString = (value) => miniCStringFromValue(value);
  const writeCString = (target, value, maxChars) => miniCWriteCString(target, value, maxChars);

  const createReaderState = (text = '') => ({ content: String(text || ''), pos: 0 });
  const isStdHandle = (h, name) => Boolean(h && typeof h === 'object' && h.__miniCStdHandle === name);
  const isFileHandle = (h) => Boolean(h && typeof h === 'object' && h.__miniCFileHandle === true && !h.closed);

  const skipWs = (state) => {
    while (state.pos < state.content.length && /\s/.test(state.content.charAt(state.pos))) state.pos += 1;
  };

  const readChar = (state) => {
    if (!state || state.pos >= state.content.length) return null;
    const ch = state.content.charAt(state.pos);
    state.pos += 1;
    return ch;
  };

  const peekChar = (state) => {
    if (!state || state.pos >= state.content.length) return null;
    return state.content.charAt(state.pos);
  };

  const readRegexToken = (state, re, { skipWhitespace = true } = {}) => {
    if (!state) return null;
    if (skipWhitespace) skipWs(state);
    const rest = state.content.slice(state.pos);
    const m = re.exec(rest);
    if (!m || !m[0]) return null;
    state.pos += m[0].length;
    return m[0];
  };

  const readScanfValue = (state, specToken) => {
    const token = String(specToken || '');
    const kind = token.charAt(token.length - 1).toLowerCase();
    if (kind === 'c') {
      const ch = readChar(state);
      return ch == null ? undefined : ch.charCodeAt(0);
    }
    if (kind === 's') {
      const s = readRegexToken(state, /^[^\s]+/);
      return s == null ? undefined : s;
    }
    if (kind === 'd' || kind === 'i') {
      const n = readRegexToken(state, /^[+-]?\d+/);
      if (n == null) return undefined;
      return Math.trunc(Number(n));
    }
    if (kind === 'u') {
      const n = readRegexToken(state, /^\d+/);
      if (n == null) return undefined;
      return (Math.trunc(Number(n)) >>> 0);
    }
    if (kind === 'x') {
      const t = readRegexToken(state, /^[+-]?(?:0x)?[0-9a-fA-F]+/);
      if (t == null) return undefined;
      return parseInt(t, 16);
    }
    if (kind === 'o') {
      const t = readRegexToken(state, /^[+-]?[0-7]+/);
      if (t == null) return undefined;
      return parseInt(t, 8);
    }
    if (kind === 'f' || kind === 'g' || kind === 'e') {
      const t = readRegexToken(state, /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/);
      if (t == null) return undefined;
      return Number(t);
    }
    return undefined;
  };

  const scanInto = (state, format, setters = []) => {
    const fmt = toCString(format);
    let assigned = 0;
    let setterIdx = 0;
    for (let i = 0; i < fmt.length; i += 1) {
      const ch = fmt.charAt(i);
      if (/\s/.test(ch)) {
        skipWs(state);
        continue;
      }
      if (ch !== '%') {
        if (peekChar(state) === ch) state.pos += 1;
        continue;
      }
      if (fmt.charAt(i + 1) === '%') {
        if (peekChar(state) === '%') state.pos += 1;
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < fmt.length && /[-+ #0*.0-9hlLzjt]/.test(fmt.charAt(j))) j += 1;
      if (j >= fmt.length) break;
      const spec = fmt.slice(i, j + 1);
      i = j;
      const setter = setters[setterIdx];
      if (typeof setter !== 'function') break;
      const value = readScanfValue(state, spec);
      if (value === undefined) break;
      try {
        setter(value);
      } catch (_) {
        break;
      }
      assigned += 1;
      setterIdx += 1;
    }
    return assigned;
  };

  const resolveMiniCFilePath = (rawPath) => {
    const p = toCString(rawPath).trim();
    if (!p) return '';
    if (path.isAbsolute(p)) return path.normalize(p);
    return path.resolve(workingDir, p);
  };

  const ensureWritableFileFlushed = (handle) => {
    if (!handle || !handle.writable || !handle.dirty) return;
    fs.writeFileSync(handle.path, handle.content, 'utf8');
    handle.dirty = false;
  };

  const getReadableStateForHandle = (handle) => {
    if (isStdHandle(handle, 'stdin')) return stdinState;
    if (isFileHandle(handle)) return handle;
    return null;
  };

  const writeToHandle = (handle, text) => {
    const chunk = String(text ?? '');
    if (isStdHandle(handle, 'stdout') || handle == null) {
      append(chunk);
      return chunk.length;
    }
    if (isStdHandle(handle, 'stderr')) {
      append(chunk);
      return chunk.length;
    }
    if (!isFileHandle(handle) || !handle.writable) {
      throw new MiniCRuntimeError('Invalid file handle for write', 1, 1, 'inbuilt:file');
    }
    if (handle.appendMode) {
      handle.pos = handle.content.length;
    }
    const start = Math.max(0, Math.trunc(Number(handle.pos) || 0));
    handle.content = `${handle.content.slice(0, start)}${chunk}${handle.content.slice(start + chunk.length)}`;
    handle.pos = start + chunk.length;
    handle.dirty = true;
    return chunk.length;
  };

  const readLineFromState = (state, maxChars) => {
    if (!state) return null;
    const limit = Math.max(0, Math.trunc(Number(maxChars) || 0));
    if (limit <= 0) return '';
    if (state.pos >= state.content.length) return null;
    let outLine = '';
    while (state.pos < state.content.length && outLine.length < (limit - 1)) {
      const ch = readChar(state);
      if (ch == null) break;
      outLine += ch;
      if (ch === '\n') break;
    }
    return outLine;
  };

  let randSeed = ((Date.now() >>> 0) & 0x7fffffff) || 1;

  const toCharCode = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value) & 0xFF;
    if (Array.isArray(value)) {
      const n = Number(value[0] || 0);
      return Number.isFinite(n) ? (Math.trunc(n) & 0xFF) : NaN;
    }
    const s = toCString(value);
    if (!s) return NaN;
    return s.charCodeAt(0) & 0xFF;
  };

  const ctypeTest = (value, regex) => {
    const code = toCharCode(value);
    if (!Number.isFinite(code)) return 0;
    return regex.test(String.fromCharCode(code)) ? 1 : 0;
  };

  const compareCStrings = (a, b, maxLen = null) => {
    const sa = toCString(a);
    const sb = toCString(b);
    const limit = maxLen == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.trunc(Number(maxLen) || 0));
    let i = 0;
    while (i < sa.length && i < sb.length && i < limit) {
      const ca = sa.charCodeAt(i);
      const cb = sb.charCodeAt(i);
      if (ca !== cb) return ca < cb ? -1 : 1;
      i += 1;
    }
    if (i >= limit) return 0;
    if (sa.length === sb.length || (i >= sa.length && i >= sb.length)) return 0;
    if (i >= sa.length) return -1;
    if (i >= sb.length) return 1;
    return sa.charCodeAt(i) < sb.charCodeAt(i) ? -1 : 1;
  };

  const resolveReadableState = (file) => getReadableStateForHandle(file);

  const getFileLength = (state) => {
    if (!state) return 0;
    return String(state.content || '').length;
  };

  const normalizeSeekWhence = (whenceValue) => {
    const n = Math.trunc(Number(whenceValue) || 0);
    if (n === 1 || n === 2) return n;
    return 0;
  };

  const rt = {
    stdin: stdinHandle,
    stdout: stdoutHandle,
    stderr: stderrHandle,
    makeArray(count, elemSize = 1) {
      return makeMiniCArray(count, elemSize);
    },
    arrayFromInit(values, size, elemSize = 1) {
      return miniCArrayFromInit(values, size, elemSize);
    },
    charBufferFromString(value, size) {
      return miniCCharBufferFromString(value, size);
    },
    writeCString(target, value, maxChars) {
      return writeCString(target, value, maxChars);
    },
    ptrSlice(baseValue, indexValue) {
      const idx = Math.max(0, Math.trunc(Number(indexValue) || 0));
      if (Array.isArray(baseValue)) return baseValue.slice(idx);
      return toCString(baseValue).slice(idx);
    },
    ptrDiff(a, b) {
      if (typeof a === 'number' && (Array.isArray(b) || typeof b === 'string')) {
        return Math.trunc(a);
      }
      return (Number(a) || 0) - (Number(b) || 0);
    },
    strtodAt(baseValue, indexValue, endSetter) {
      const text = toCString(baseValue);
      const start = Math.max(0, Math.trunc(Number(indexValue) || 0));
      const rest = text.slice(start);
      const m = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(rest);
      if (!m || !m[0]) {
        try { if (typeof endSetter === 'function') endSetter(start); } catch (_) {}
        return 0;
      }
      const nextPos = start + m[0].length;
      try { if (typeof endSetter === 'function') endSetter(nextPos); } catch (_) {}
      return Number(m[0]);
    },
    strcmp(a, b) {
      const sa = toCString(a);
      const sb = toCString(b);
      if (sa === sb) return 0;
      return sa < sb ? -1 : 1;
    },
    strcspn(textValue, rejectCharsValue) {
      const text = toCString(textValue);
      const rejectChars = toCString(rejectCharsValue);
      if (!rejectChars) return text.length;
      const rejectSet = new Set(rejectChars.split(''));
      let i = 0;
      while (i < text.length) {
        if (rejectSet.has(text.charAt(i))) return i;
        i += 1;
      }
      return text.length;
    },
    isspace(value) {
      const n = typeof value === 'number' ? value : toCString(value).charCodeAt(0);
      if (!Number.isFinite(n)) return 0;
      return /\s/.test(String.fromCharCode(n)) ? 1 : 0;
    },
    isalpha(value) {
      const n = typeof value === 'number' ? value : toCString(value).charCodeAt(0);
      if (!Number.isFinite(n)) return 0;
      const ch = String.fromCharCode(n);
      return /[A-Za-z]/.test(ch) ? 1 : 0;
    },
    isdigit(value) {
      const n = typeof value === 'number' ? value : toCString(value).charCodeAt(0);
      if (!Number.isFinite(n)) return 0;
      const ch = String.fromCharCode(n);
      return /[0-9]/.test(ch) ? 1 : 0;
    },
    isalnum(value) {
      return ctypeTest(value, /[A-Za-z0-9]/);
    },
    islower(value) {
      return ctypeTest(value, /[a-z]/);
    },
    isupper(value) {
      return ctypeTest(value, /[A-Z]/);
    },
    tolower(value) {
      const code = toCharCode(value);
      if (!Number.isFinite(code)) return 0;
      return String.fromCharCode(code).toLowerCase().charCodeAt(0) & 0xFF;
    },
    toupper(value) {
      const code = toCharCode(value);
      if (!Number.isFinite(code)) return 0;
      return String.fromCharCode(code).toUpperCase().charCodeAt(0) & 0xFF;
    },
    strlen(value) {
      return toCString(value).length;
    },
    strcpy(dst, src) {
      writeCString(dst, src);
      return dst;
    },
    strncpy(dst, src, count) {
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      if (!Array.isArray(dst)) {
        return toCString(src).slice(0, n);
      }
      if (dst.length < n) dst.length = n;
      const text = toCString(src);
      let i = 0;
      for (; i < n && i < text.length; i += 1) dst[i] = text.charCodeAt(i) & 0xFF;
      for (; i < n; i += 1) dst[i] = 0;
      if (!getMiniCArrayMeta(dst)) setMiniCArrayMeta(dst, { elemSize: 1 });
      return dst;
    },
    strcat(dst, src) {
      const combined = `${toCString(dst)}${toCString(src)}`;
      writeCString(dst, combined);
      return dst;
    },
    strncat(dst, src, count) {
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      const combined = `${toCString(dst)}${toCString(src).slice(0, n)}`;
      writeCString(dst, combined);
      return dst;
    },
    strncmp(a, b, count) {
      return compareCStrings(a, b, count);
    },
    memcmp(a, b, count) {
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      for (let i = 0; i < n; i += 1) {
        const av = Array.isArray(a) ? (Math.trunc(Number(a[i] || 0)) & 0xFF) : (toCString(a).charCodeAt(i) || 0);
        const bv = Array.isArray(b) ? (Math.trunc(Number(b[i] || 0)) & 0xFF) : (toCString(b).charCodeAt(i) || 0);
        if (av !== bv) return av < bv ? -1 : 1;
      }
      return 0;
    },
    strchr(textValue, chValue) {
      const text = toCString(textValue);
      const code = toCharCode(chValue);
      const needle = Number.isFinite(code) ? String.fromCharCode(code) : '\0';
      const idx = text.indexOf(needle);
      if (idx < 0) return 0;
      return rt.ptrSlice(textValue, idx);
    },
    strrchr(textValue, chValue) {
      const text = toCString(textValue);
      const code = toCharCode(chValue);
      const needle = Number.isFinite(code) ? String.fromCharCode(code) : '\0';
      const idx = text.lastIndexOf(needle);
      if (idx < 0) return 0;
      return rt.ptrSlice(textValue, idx);
    },
    strstr(haystackValue, needleValue) {
      const hay = toCString(haystackValue);
      const needle = toCString(needleValue);
      if (!needle) return rt.ptrSlice(haystackValue, 0);
      const idx = hay.indexOf(needle);
      if (idx < 0) return 0;
      return rt.ptrSlice(haystackValue, idx);
    },
    sizeof(value) {
      if (Array.isArray(value)) {
        const meta = getMiniCArrayMeta(value);
        const elemSize = Math.max(1, Number(meta?.elemSize) || 1);
        return Math.max(0, value.length) * elemSize;
      }
      if (typeof value === 'string') return value.length + 1;
      if (typeof value === 'number' || typeof value === 'boolean') return 4;
      if (isFileHandle(value) || isStdHandle(value, 'stdin') || isStdHandle(value, 'stdout') || isStdHandle(value, 'stderr')) return 8;
      if (value == null) return 0;
      return 8;
    },
    printf(format, ...args) {
      if (typeof format !== 'string') {
        append(toCString(format));
        if (args.length) append(args.map((v) => toCString(v)).join(' '));
        return 0;
      }
      let argIdx = 0;
      const rendered = format.replace(/%%|%[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|L)?[diufgcsxo]/gi, (token) => {
        if (token === '%%') return '%';
        const value = args[argIdx];
        argIdx += 1;
        return formatPrintfValue(token, value);
      });
      append(rendered);
      return rendered.length;
    },
    puts(value) {
      const text = toCString(value);
      append(text);
      append('\n');
      return text.length + 1;
    },
    putchar(value) {
      const ch = (typeof value === 'number')
        ? String.fromCharCode(Math.trunc(value))
        : String(value ?? '').charAt(0);
      append(ch || '');
      return (ch && ch.length) ? ch.charCodeAt(0) : 0;
    },
    getchar() {
      const ch = readChar(stdinState);
      return ch == null ? -1 : ch.charCodeAt(0);
    },
    scanfAssign(format, ...setters) {
      return scanInto(stdinState, format, setters);
    },
    fscanfAssign(file, format, ...setters) {
      const state = getReadableStateForHandle(file);
      if (!state) return 0;
      return scanInto(state, format, setters);
    },
    fopen(filePath, modeValue) {
      const resolved = resolveMiniCFilePath(filePath);
      const mode = toCString(modeValue || 'r').trim() || 'r';
      if (!resolved) return 0;
      const readAllowed = /r|\+/.test(mode);
      const writeAllowed = /w|a|\+/.test(mode);
      const appendMode = /a/.test(mode);
      let content = '';
      try {
        if (fs.existsSync(resolved)) {
          content = fs.readFileSync(resolved, 'utf8');
        } else if (!/w|a/.test(mode)) {
          return 0;
        }
      } catch (_) {
        return 0;
      }
      if (/w/.test(mode) && !appendMode) content = '';
      const handle = {
        __miniCFileHandle: true,
        id: nextFileId,
        path: resolved,
        mode,
        readable: readAllowed,
        writable: writeAllowed,
        appendMode,
        closed: false,
        content,
        pos: appendMode ? content.length : 0,
        dirty: false
      };
      nextFileId += 1;
      fileHandles.set(handle.id, handle);
      return handle;
    },
    fclose(file) {
      if (isStdHandle(file, 'stdin') || isStdHandle(file, 'stdout') || isStdHandle(file, 'stderr')) return 0;
      if (!isFileHandle(file)) return -1;
      ensureWritableFileFlushed(file);
      file.closed = true;
      fileHandles.delete(file.id);
      return 0;
    },
    fprintf(file, format, ...args) {
      const rendered = (typeof format === 'string')
        ? format.replace(/%%|%[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|L)?[diufgcsxo]/gi, (token) => {
          if (token === '%%') return '%';
          const value = args.length ? args.shift() : undefined;
          return formatPrintfValue(token, value);
        })
        : [toCString(format), ...args.map((v) => toCString(v))].join(' ');
      return writeToHandle(file, rendered);
    },
    fputs(value, file) {
      return writeToHandle(file, toCString(value));
    },
    fgetc(file) {
      const state = getReadableStateForHandle(file);
      if (!state) return -1;
      const ch = readChar(state);
      return ch == null ? -1 : ch.charCodeAt(0);
    },
    fgets(buffer, size, file) {
      const state = getReadableStateForHandle(file || stdinHandle);
      if (!state) return 0;
      const line = readLineFromState(state, size);
      if (line == null) return 0;
      if (Array.isArray(buffer)) {
        writeCString(buffer, line, size);
        return buffer;
      }
      return line;
    },
    feof(file) {
      const state = resolveReadableState(file || stdinHandle);
      if (!state) return 1;
      return state.pos >= getFileLength(state) ? 1 : 0;
    },
    ftell(file) {
      if (isStdHandle(file, 'stdin')) return Math.max(0, Math.trunc(Number(stdinState.pos) || 0));
      if (!isFileHandle(file)) return -1;
      return Math.max(0, Math.trunc(Number(file.pos) || 0));
    },
    fseek(file, offsetValue, whenceValue) {
      if (!isFileHandle(file)) return -1;
      const offset = Math.trunc(Number(offsetValue) || 0);
      const whence = normalizeSeekWhence(whenceValue);
      const len = getFileLength(file);
      let base = 0;
      if (whence === 1) base = Math.max(0, Math.trunc(Number(file.pos) || 0));
      else if (whence === 2) base = len;
      file.pos = Math.max(0, Math.min(len, base + offset));
      return 0;
    },
    rewind(file) {
      if (!isFileHandle(file)) return;
      file.pos = 0;
    },
    remove(filePath) {
      const resolved = resolveMiniCFilePath(filePath);
      if (!resolved) return -1;
      try {
        fs.unlinkSync(resolved);
        return 0;
      } catch (_) {
        return -1;
      }
    },
    rename(oldPath, newPath) {
      const from = resolveMiniCFilePath(oldPath);
      const to = resolveMiniCFilePath(newPath);
      if (!from || !to) return -1;
      try {
        fs.renameSync(from, to);
        return 0;
      } catch (_) {
        return -1;
      }
    },
    malloc(size) {
      return makeMiniCArray(size, 1);
    },
    calloc(count, size) {
      return makeMiniCArray((Number(count) || 0) * (Number(size) || 0), 1);
    },
    realloc(ptr, size) {
      const targetSize = Math.max(0, Math.trunc(Number(size) || 0));
      const prev = Array.isArray(ptr) ? ptr : [];
      const elemSize = Math.max(1, Number(getMiniCArrayMeta(prev)?.elemSize) || 1);
      const next = makeMiniCArray(targetSize, elemSize);
      const copyCount = Math.min(prev.length, next.length);
      for (let i = 0; i < copyCount; i += 1) next[i] = prev[i];
      return next;
    },
    free() {
      return 0;
    },
    memset(ptr, value, count) {
      if (!Array.isArray(ptr)) return ptr;
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      const v = Math.trunc(Number(value) || 0) & 0xFF;
      const max = Math.min(ptr.length, n);
      for (let i = 0; i < max; i += 1) ptr[i] = v;
      return ptr;
    },
    memcpy(dst, src, count) {
      if (!Array.isArray(dst)) return dst;
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      const srcArr = Array.isArray(src) ? src : [];
      const max = Math.min(n, dst.length, srcArr.length);
      for (let i = 0; i < max; i += 1) dst[i] = srcArr[i];
      return dst;
    },
    memmove(dst, src, count) {
      if (!Array.isArray(dst)) return dst;
      const n = Math.max(0, Math.trunc(Number(count) || 0));
      const srcArr = Array.isArray(src) ? src : [];
      const tmp = srcArr.slice(0, n);
      const max = Math.min(n, dst.length, tmp.length);
      for (let i = 0; i < max; i += 1) dst[i] = tmp[i];
      return dst;
    },
    atoi(value) {
      const m = /^\s*([+-]?\d+)/.exec(toCString(value));
      return m ? (Math.trunc(Number(m[1])) || 0) : 0;
    },
    atof(value) {
      const m = /^\s*([+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)/.exec(toCString(value));
      return m ? (Number(m[1]) || 0) : 0;
    },
    srand(seed) {
      randSeed = (Math.trunc(Number(seed) || 0) >>> 0) & 0x7fffffff;
      if (!randSeed) randSeed = 1;
    },
    rand() {
      randSeed = (Math.imul(randSeed, 1103515245) + 12345) & 0x7fffffff;
      return randSeed;
    },
    time() {
      return Math.floor(Date.now() / 1000);
    },
    fmod(a, b) {
      const x = Number(a) || 0;
      const y = Number(b) || 0;
      if (!Number.isFinite(y) || y === 0) return NaN;
      return x % y;
    },
    floor(v) {
      return Math.floor(Number(v) || 0);
    },
    ceil(v) {
      return Math.ceil(Number(v) || 0);
    },
    round(v) {
      return Math.round(Number(v) || 0);
    },
    log10(v) {
      return Math.log10 ? Math.log10(Number(v) || 0) : (Math.log(Number(v) || 0) / Math.LN10);
    },
    asin(v) {
      return Math.asin(Number(v) || 0);
    },
    acos(v) {
      return Math.acos(Number(v) || 0);
    },
    atan(v) {
      return Math.atan(Number(v) || 0);
    },
    atan2(y, x) {
      return Math.atan2(Number(y) || 0, Number(x) || 0);
    },
    exit(code) {
      const n = Math.trunc(Number(code) || 0);
      throw new MiniCRuntimeError(`Program exited with code ${n}`, 1, 1, 'inbuilt:exit');
    },
    unsupported(name) {
      throw new MiniCRuntimeError(`${String(name || 'API')} is not supported by inbuilt compiler`, 1, 1, 'inbuilt:unsupported-api');
    },
    getOutput() {
      for (const handle of fileHandles.values()) {
        if (!handle.closed) {
          try { ensureWritableFileFlushed(handle); } catch (_) {}
        }
      }
      return output;
    }
  };

  return rt;
}

function buildExecutionScript(transpiledC) {
  const userCode = String(transpiledC || '');
  const prelude = [
    '"use strict";',
    'const __rt = globalThis.__miniCrt;',
    'const stdin = __rt.stdin;',
    'const stdout = __rt.stdout;',
    'const stderr = __rt.stderr;',
    'const printf = (...a) => __rt.printf(...a);',
    'const puts = (...a) => __rt.puts(...a);',
    'const putchar = (...a) => __rt.putchar(...a);',
    'const getchar = (...a) => __rt.getchar(...a);',
    'const scanf = (...a) => __rt.scanfAssign(...a);',
    'const fscanf = (...a) => __rt.fscanfAssign(...a);',
    'const fopen = (...a) => __rt.fopen(...a);',
    'const fclose = (...a) => __rt.fclose(...a);',
    'const fprintf = (...a) => __rt.fprintf(...a);',
    'const fputs = (...a) => __rt.fputs(...a);',
    'const fgetc = (...a) => __rt.fgetc(...a);',
    'const fgets = (...a) => __rt.fgets(...a);',
    'const feof = (...a) => __rt.feof(...a);',
    'const ftell = (...a) => __rt.ftell(...a);',
    'const fseek = (...a) => __rt.fseek(...a);',
    'const rewind = (...a) => __rt.rewind(...a);',
    'const remove = (...a) => __rt.remove(...a);',
    'const rename = (...a) => __rt.rename(...a);',
    'const strcmp = (...a) => __rt.strcmp(...a);',
    'const strncmp = (...a) => __rt.strncmp(...a);',
    'const strcpy = (...a) => __rt.strcpy(...a);',
    'const strncpy = (...a) => __rt.strncpy(...a);',
    'const strcat = (...a) => __rt.strcat(...a);',
    'const strncat = (...a) => __rt.strncat(...a);',
    'const strcspn = (...a) => __rt.strcspn(...a);',
    'const strchr = (...a) => __rt.strchr(...a);',
    'const strrchr = (...a) => __rt.strrchr(...a);',
    'const strstr = (...a) => __rt.strstr(...a);',
    'const isspace = (...a) => __rt.isspace(...a);',
    'const isalpha = (...a) => __rt.isalpha(...a);',
    'const isdigit = (...a) => __rt.isdigit(...a);',
    'const isalnum = (...a) => __rt.isalnum(...a);',
    'const islower = (...a) => __rt.islower(...a);',
    'const isupper = (...a) => __rt.isupper(...a);',
    'const tolower = (...a) => __rt.tolower(...a);',
    'const toupper = (...a) => __rt.toupper(...a);',
    'const malloc = (...a) => __rt.malloc(...a);',
    'const calloc = (...a) => __rt.calloc(...a);',
    'const realloc = (...a) => __rt.realloc(...a);',
    'const free = (...a) => __rt.free(...a);',
    'const memset = (...a) => __rt.memset(...a);',
    'const memcpy = (...a) => __rt.memcpy(...a);',
    'const memmove = (...a) => __rt.memmove(...a);',
    'const memcmp = (...a) => __rt.memcmp(...a);',
    'const strlen = (v) => __rt.strlen(v);',
    'const atoi = (v) => __rt.atoi(v);',
    'const atof = (v) => __rt.atof(v);',
    'const srand = (v) => __rt.srand(v);',
    'const rand = () => __rt.rand();',
    'const time = (...a) => __rt.time(...a);',
    'const fmod = (a,b) => __rt.fmod(a,b);',
    'const fabs = (v) => Math.abs(Number(v) || 0);',
    'const abs = (v) => Math.abs(Number(v) || 0);',
    'const sqrt = (v) => Math.sqrt(Number(v) || 0);',
    'const pow = (a,b) => Math.pow(Number(a) || 0, Number(b) || 0);',
    'const log = (v) => Math.log(Number(v) || 0);',
    'const log10 = (v) => __rt.log10(v);',
    'const exp = (v) => Math.exp(Number(v) || 0);',
    'const floor = (v) => __rt.floor(v);',
    'const ceil = (v) => __rt.ceil(v);',
    'const round = (v) => __rt.round(v);',
    'const sin = (v) => Math.sin(Number(v) || 0);',
    'const cos = (v) => Math.cos(Number(v) || 0);',
    'const tan = (v) => Math.tan(Number(v) || 0);',
    'const asin = (v) => __rt.asin(v);',
    'const acos = (v) => __rt.acos(v);',
    'const atan = (v) => __rt.atan(v);',
    'const atan2 = (y,x) => __rt.atan2(y,x);',
    'const exit = (code) => __rt.exit(code);'
  ];
  const lines = [
    ...prelude,
    userCode,
    'globalThis.__miniCRet = (typeof main === "function") ? main(0, []) : 0;'
  ];
  return {
    code: lines.join('\n'),
    wrapperPrefixLines: prelude.length
  };
}

function normalizeRuntimeExitCode(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.trunc(n);
}

function makeDiag(line, col, message, code = 'inbuilt:compile', severity = 'error') {
  return [{
    line: Math.max(1, Number(line) || 1),
    col: Math.max(1, Number(col) || 1),
    severity: severity === 'warning' ? 'warning' : 'error',
    code: String(code || 'inbuilt:compile'),
    message: String(message || '')
  }];
}

async function runInbuiltCProgram(options = {}) {
  const sourcePath = path.resolve(String(options.sourcePath || options.path || ''));
  const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (256 * 1024));
  const timeoutMs = Math.max(250, Number(options.timeoutMs) || 800);
  let sourceText = '';

  try {
    sourceText = await fs.promises.readFile(sourcePath, 'utf8');
  } catch (error) {
    return {
      success: false,
      phase: 'compile',
      compiler: 'inbuilt-mini-c',
      compilerProfile: 'inbuilt',
      error: `Could not read source file: ${error?.message || error}`,
      diagnostics: makeDiag(1, 1, `Could not read source file: ${error?.message || error}`, 'inbuilt:io')
    };
  }

  let transpiled = '';
  try {
    transpiled = transpileCSubsetToJs(sourceText);
  } catch (error) {
    const line = Number(error?.line) || 1;
    const col = Number(error?.col) || 1;
    const msg = String(error?.message || 'Inbuilt compiler failed');
    return {
      success: false,
      phase: 'compile',
      compiler: 'inbuilt-mini-c',
      compilerProfile: 'inbuilt',
      error: msg,
      diagnostics: makeDiag(line, col, msg, error?.code || 'inbuilt:compile')
    };
  }

  const scriptBuild = buildExecutionScript(transpiled);
  const runtime = createMiniCRuntime({
    maxOutputBytes,
    sourcePath,
    workingDir: path.dirname(sourcePath),
    stdin: options.stdin || options.stdinText || options.input || ''
  });
  const sandbox = {
    __miniCrt: runtime,
    __miniCRet: 0,
    Math,
    Number,
    String,
    Boolean,
    JSON
  };
  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(scriptBuild.code, {
      filename: sourcePath || 'generated.minic',
      displayErrors: true
    });
    script.runInContext(context, { timeout: timeoutMs, displayErrors: true });
  } catch (error) {
    const loc = parseLocationFromErrorStack(error, sourcePath, scriptBuild.wrapperPrefixLines);
    const rawMsg = String(error?.message || error || 'Inbuilt runtime failed');
    const isCompileLike = /Unexpected token|Unexpected identifier|missing \)|missing ]|Invalid or unexpected token|Function statements require|SyntaxError/i.test(rawMsg);
    const phase = (error instanceof MiniCCompileError || isCompileLike) ? 'compile' : 'run';
    const code = phase === 'compile' ? 'inbuilt:compile' : 'inbuilt:runtime';
    const msg = phase === 'compile'
      ? `Inbuilt compiler supports an extended C subset (still not full C). ${rawMsg}`
      : rawMsg;
    return {
      success: false,
      phase,
      compiler: 'inbuilt-mini-c',
      compilerProfile: 'inbuilt',
      error: msg,
      diagnostics: makeDiag(loc.line, loc.col, msg, code),
      output: runtime.getOutput ? runtime.getOutput() : ''
    };
  }

  const output = String(runtime.getOutput ? runtime.getOutput() : '');
  const exitCode = normalizeRuntimeExitCode(context.__miniCRet);
  return {
    success: exitCode === 0,
    phase: 'run',
    compiler: 'inbuilt-mini-c',
    compilerProfile: 'inbuilt',
    compilerCommand: 'inbuilt',
    compileOutput: 'Used Coder inbuilt compiler (extended subset) because no system compiler was available.',
    output,
    diagnostics: [],
    exitCode,
    timedOut: false,
    error: exitCode === 0 ? '' : `Program exited with code ${exitCode}`
  };
}

module.exports = {
  runInbuiltCProgram
};
