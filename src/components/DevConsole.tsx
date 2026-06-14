import { useEffect, useRef, useState } from 'react';
import { execCommand, type ConsoleLine } from '../game/console';

const GREETING: ConsoleLine[] = [
  { text: '⚙ Dev-консоль. help — список команд, Esc — закрыть.', kind: 'out' },
];

export default function DevConsole() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ConsoleLine[]>(GREETING);
  const history = useRef<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Глобальный тогл по ` / ё
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote') return;
      const t = e.target as HTMLElement;
      // Внутри поля консоли — печатаем символ « ` » (нужно для секретного кода), не тогглим.
      if (t === inputRef.current) return;
      // Не перехватываем тильду в других полях ввода (например, имя лорда).
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  if (!open) return null;

  const run = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    history.current = [cmd, ...history.current.filter((c) => c !== cmd)].slice(0, 50);
    setHistIdx(-1);
    setInput('');
    setLines((prev) => [...prev, { text: `> ${cmd}`, kind: 'cmd' as const }].slice(-200));
    try {
      const result = await execCommand(cmd);
      setLines((prev) => [...prev, ...result].slice(-200));
    } catch (e) {
      setLines((prev) => [...prev, { text: `Ошибка: ${(e as Error).message}`, kind: 'err' as const }].slice(-200));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { run(); return; }
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.current.length - 1);
      if (next >= 0 && history.current[next] !== undefined) {
        setHistIdx(next);
        setInput(history.current[next]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(Math.max(next, -1));
      setInput(next >= 0 ? history.current[next] : '');
    }
  };

  return (
    <div className="dev-console">
      <div className="dev-console-head">
        <span>DEV CONSOLE</span>
        <button onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="dev-console-body" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((l, i) => (
          <div key={i} className={`dc-line dc-${l.kind}`}>{l.text}</div>
        ))}
      </div>
      <div className="dev-console-input-row">
        <span className="dc-prompt">&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHistIdx(-1); }}
          onKeyDown={onKeyDown}
          placeholder="help"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
