import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import TwitchLoginButton from "../components/auth/TwitchLoginButton";
import { useAuth } from "../hooks/useAuth";

/** Animation variant: fade up on scroll */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

/** Stagger container for children */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/** Feature card data */
const FEATURES = [
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Система лиг",
    desc: "Мэтчинг по уровню — Бронза, Серебро, Золото, Платина. Находи стримеров своего масштаба.",
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    title: "Свайпай и мэтчься",
    desc: "Как в Tinder — свайпай вправо, чтобы лайкнуть, влево — пропустить. Взаимный лайк = мэтч!",
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: "Чат в реальном времени",
    desc: "После мэтча открывается чат. Обсуждай коллабы, планируй совместные стримы.",
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: "Супер-лайки",
    desc: "Выделись среди остальных! Супер-лайк отправляет уведомление и ставит тебя в топ ленты.",
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Аналитика Twitch",
    desc: "Автоматическая синхронизация данных: зрители, подписчики, категории — всё актуально.",
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Безопасность",
    desc: "Авторизация через Twitch, жалобы и блокировки, модерация — безопасная среда для всех.",
  },
];

/** Animated section wrapper that fades in on scroll */
function ScrollSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Landing page — hero section, features grid, league tiers, and footer.
 *
 * Uses Framer Motion for scroll-triggered animations.
 * Authenticated users see a CTA to go to feed instead of login.
 */
export default function Landing() {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section — fullscreen centered with gradient backdrop */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Background gradient glow — dual blobs for depth */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-twitch-purple/8 blur-[140px]" />
          <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-purple-600/5 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Logo / brand */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="#9146FF"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-gray-300">StreamMatch</span>
          </div>

          <h1 className="mb-5 text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Найди стримера
            <br />
            <span className="bg-gradient-to-r from-twitch-purple to-purple-400 bg-clip-text text-transparent">
              для коллаба
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-gray-400 sm:max-w-xl sm:text-lg md:text-xl">
            Свайпай, мэтчься и организуй совместные стримы.
            <br className="hidden sm:block" />
            Система лиг подберёт стримеров твоего уровня.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {isLoading ? (
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-twitch-purple border-t-transparent" />
            ) : isAuthenticated && user ? (
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="/feed"
                  className="rounded-xl bg-twitch-purple px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-twitch-purple/25 transition-all hover:bg-twitch-purple-hover hover:shadow-twitch-purple/40"
                >
                  Перейти к ленте
                </a>
                {user.is_admin && (
                  <a
                    href="/admin"
                    className="rounded-xl border border-twitch-purple/50 px-6 py-3.5 font-semibold text-twitch-purple transition-all hover:bg-twitch-purple hover:text-white"
                  >
                    Админ-панель
                  </a>
                )}
              </div>
            ) : (
              <TwitchLoginButton />
            )}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1 }, y: { repeat: Infinity, duration: 2 } }}
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="px-4 py-24">
        <ScrollSection className="mx-auto max-w-app text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Как это работает?</h2>
          <p className="mx-auto mb-16 max-w-2xl text-gray-400">
            Три простых шага — и ты готов к коллабам
          </p>
        </ScrollSection>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-app grid-cols-1 gap-8 md:grid-cols-3"
        >
          {[
            { step: "1", title: "Войди через Twitch", desc: "Авторизуйся одним кликом. Мы автоматически загрузим твой профиль и статистику." },
            { step: "2", title: "Свайпай стримеров", desc: "Смотри профили из своей лиги. Лайкай интересных — пропускай остальных." },
            { step: "3", title: "Общайся и коллабься", desc: "При взаимном лайке открывается чат. Планируйте совместные стримы!" },
          ].map((item) => (
            <motion.div key={item.step} variants={fadeUp} className="rounded-card border border-border bg-surface p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-twitch-purple/20 text-2xl font-bold text-twitch-purple">
                {item.step}
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-4 py-24">
        <ScrollSection className="mx-auto max-w-app text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Возможности</h2>
          <p className="mx-auto mb-16 max-w-2xl text-gray-400">
            Всё, что нужно стримеру для поиска идеального партнёра для коллаба
          </p>
        </ScrollSection>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-app grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="group flex flex-col items-center rounded-card border border-border bg-surface p-6 text-center transition-colors hover:border-twitch-purple/50"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-twitch-purple/10 text-twitch-purple transition-colors group-hover:bg-twitch-purple/20">
                {f.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* League tiers */}
      <section className="px-4 py-24">
        <ScrollSection className="mx-auto max-w-app text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Система лиг</h2>
          <p className="mx-auto mb-16 max-w-2xl text-gray-400">
            Лига определяется автоматически по среднему количеству зрителей
          </p>
        </ScrollSection>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-app grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
        >
          {([
            { name: "Бронза", range: "0 – 50", color: "#CD7F32" },
            { name: "Серебро", range: "51 – 250", color: "#C0C0C0" },
            { name: "Золото", range: "251 – 1 000", color: "#FFD700" },
            { name: "Платина", range: "1 001+", color: "#E5E4E2" },
          ] as const).map((league) => (
            <motion.div
              key={league.name}
              variants={fadeUp}
              className="rounded-card border p-6 text-center"
              style={{ borderColor: `${league.color}30`, backgroundColor: `${league.color}08` }}
            >
              <svg
                className="mx-auto mb-3 h-10 w-10"
                viewBox="0 0 24 24"
                fill={league.color}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <h3 className="text-lg font-bold" style={{ color: league.color }}>{league.name}</h3>
              <p className="mt-1 text-sm text-gray-400">{league.range} зрителей</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-24">
        <ScrollSection>
          <div className="mx-auto max-w-2xl rounded-card border border-twitch-purple/30 bg-twitch-purple/5 p-10 text-center sm:p-14">
            <h2 className="mb-4 text-3xl font-bold text-white">Готов к коллабам?</h2>
            <p className="mb-8 text-gray-400">
              Присоединяйся к StreamMatch — это бесплатно!
            </p>
            {isAuthenticated ? (
              <a
                href="/feed"
                className="inline-block rounded-xl bg-twitch-purple px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-twitch-purple/25 transition-all hover:bg-twitch-purple-hover hover:shadow-twitch-purple/40"
              >
                Открыть ленту
              </a>
            ) : (
              <TwitchLoginButton />
            )}
          </div>
        </ScrollSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-app flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#9146FF" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            <span className="text-sm font-medium">StreamMatch</span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} StreamMatch. Не аффилирован с Twitch.
          </p>
        </div>
      </footer>
    </div>
  );
}
