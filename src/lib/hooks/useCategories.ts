"use client";

import { useState, useEffect } from "react";

export interface Category { id: string; label: string; description?: string; }

let cache: Category[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setCategories(cache); setLoading(false); return; }
    fetch("/api/categories")
      .then(r => r.json())
      .then(d => {
        cache = d.categories || [];
        setCategories(cache!);
        setLoading(false);
      });
  }, []);

  const labelMap = Object.fromEntries(categories.map(c => [c.id, c.label]));

  return { categories, loading, labelMap };
}
