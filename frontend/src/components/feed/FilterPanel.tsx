import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCategories } from "../../hooks/useFeed";
import { useFeedStore } from "../../stores/feedStore";

/**
 * Collapsible filter panel for the swipe feed.
 *
 * Provides controls for:
 * - Category multi-select (searchable)
 * - Viewer count range (min/max inputs)
 * - Follower count range (min/max inputs)
 * - Stream language select
 *
 * Filters are stored in the feedStore (Zustand) and applied
 * when the user clicks "Применить".
 */
export default function FilterPanel() {
  const {
    filters,
    isFilterOpen,
    setFilters,
    resetFilters,
    toggleFilterPanel,
  } = useFeedStore();

  // Local state for edits before applying
  const [localCategories, setLocalCategories] = useState<string[]>(
    filters.categories ?? [],
  );
  const [localMinViewers, setLocalMinViewers] = useState(
    filters.min_viewers?.toString() ?? "",
  );
  const [localMaxViewers, setLocalMaxViewers] = useState(
    filters.max_viewers?.toString() ?? "",
  );
  const [localMinFollowers, setLocalMinFollowers] = useState(
    filters.min_followers?.toString() ?? "",
  );
  const [localMaxFollowers, setLocalMaxFollowers] = useState(
    filters.max_followers?.toString() ?? "",
  );
  const [localLanguage, setLocalLanguage] = useState(filters.language ?? "");
  const [categorySearch, setCategorySearch] = useState("");

  const { data: categoriesData } = useCategories();
  const allCategories = categoriesData?.categories ?? [];

  // Filter categories by search text
  const filteredCategories = categorySearch
    ? allCategories.filter((c) =>
        c.category_name.toLowerCase().includes(categorySearch.toLowerCase()),
      )
    : allCategories;

  const toggleCategory = (categoryId: string) => {
    setLocalCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const handleApply = () => {
    setFilters({
      categories: localCategories.length > 0 ? localCategories : undefined,
      min_viewers: localMinViewers ? parseInt(localMinViewers, 10) : undefined,
      max_viewers: localMaxViewers ? parseInt(localMaxViewers, 10) : undefined,
      min_followers: localMinFollowers ? parseInt(localMinFollowers, 10) : undefined,
      max_followers: localMaxFollowers ? parseInt(localMaxFollowers, 10) : undefined,
      language: localLanguage || undefined,
    });
    toggleFilterPanel();
  };

  const handleReset = () => {
    setLocalCategories([]);
    setLocalMinViewers("");
    setLocalMaxViewers("");
    setLocalMinFollowers("");
    setLocalMaxFollowers("");
    setLocalLanguage("");
    resetFilters();
  };

  // Active filter count for badge
  const activeFilterCount = [
    filters.categories && filters.categories.length > 0,
    filters.min_viewers !== undefined,
    filters.max_viewers !== undefined,
    filters.min_followers !== undefined,
    filters.max_followers !== undefined,
    filters.language !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggleFilterPanel}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-twitch-purple hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        Фильтры
        {activeFilterCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-twitch-purple text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter panel dropdown */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-card border border-border bg-surface shadow-2xl sm:right-auto sm:w-96"
          >
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Фильтры ленты
              </h3>

              {/* Categories */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium text-gray-400">
                  Категории
                </label>
                <input
                  type="text"
                  placeholder="Поиск категорий..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none"
                />
                <div className="max-h-32 overflow-y-auto">
                  {filteredCategories.slice(0, 20).map((cat) => (
                    <label
                      key={cat.category_id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-background"
                    >
                      <input
                        type="checkbox"
                        checked={localCategories.includes(cat.category_id)}
                        onChange={() => toggleCategory(cat.category_id)}
                        className="h-4 w-4 rounded border-border bg-background text-twitch-purple accent-twitch-purple"
                      />
                      {cat.category_name}
                    </label>
                  ))}
                  {filteredCategories.length === 0 && (
                    <p className="px-2 py-1 text-xs text-gray-500">
                      Категории не найдены
                    </p>
                  )}
                </div>
              </div>

              {/* Viewer range */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium text-gray-400">
                  Средние зрители
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Мин"
                    min={0}
                    value={localMinViewers}
                    onChange={(e) => setLocalMinViewers(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="number"
                    placeholder="Макс"
                    min={0}
                    value={localMaxViewers}
                    onChange={(e) => setLocalMaxViewers(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none"
                  />
                </div>
              </div>

              {/* Follower range */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium text-gray-400">
                  Подписчики
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Мин"
                    min={0}
                    value={localMinFollowers}
                    onChange={(e) => setLocalMinFollowers(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="number"
                    placeholder="Макс"
                    min={0}
                    value={localMaxFollowers}
                    onChange={(e) => setLocalMaxFollowers(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-twitch-purple focus:outline-none"
                  />
                </div>
              </div>

              {/* Language */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium text-gray-400">
                  Язык стрима
                </label>
                <select
                  value={localLanguage}
                  onChange={(e) => setLocalLanguage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white focus:border-twitch-purple focus:outline-none"
                >
                  <option value="">Любой</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="pt">Português</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 rounded-lg bg-twitch-purple py-2.5 text-sm font-semibold text-white transition-colors hover:bg-twitch-purple-hover"
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
                >
                  Сбросить
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
