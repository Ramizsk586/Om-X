export const EMOJIS = ['😀','😁','😂','😍','🎉','🔥','👍','🎯','🤖','🚀','🎮','🥳','👌','🙌','😎','❤️','👏','💯','✨','😅','😮','😢','✅','❗','🔧','📌'];

export function initEmojiPicker(onPick) {
  const picker = document.getElementById('emoji-picker');
  if (!picker) return;

  picker.innerHTML = '';
  for (const emoji of EMOJIS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => onPick(emoji));
    picker.appendChild(btn);
  }
}
