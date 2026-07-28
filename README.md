# Марш Империй

Браузерная стратегия в стиле March of Empires: замок, карта мира с ботами, бои, щиты, фракции, исследования, офлайн-прогресс. Опционально — общий онлайн-мир через Supabase (см. `supabase_schema.sql`), ключи берутся из `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); без них игра работает полностью оффлайн.

React 18 + Vite + TypeScript, Zustand, Framer Motion, SVG-графика.

```bash
npm install
npm run dev
```

Открой http://localhost:5173. Прогресс хранится в localStorage. Продакшен-сборка: `npm run build`.
