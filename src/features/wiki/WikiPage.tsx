import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Filter, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import { fetchServices } from "../../lib/supabase/queries";
import type { AwsService } from "../../lib/supabase/types";
import { cn } from "../../lib/styles";
import { ServiceModal } from "./ServiceModal";

const featureImage =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80";

function uniqueCategories(services: AwsService[]) {
  return [...new Set(services.map((service) => service.category).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function WikiPage() {
  const { envStatus, client } = useSupabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<AwsService[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedService, setSelectedService] = useState<AwsService | null>(null);
  const selectedServiceId = searchParams.get("service");
  const selectedCategoryParam = searchParams.get("category");

  useEffect(() => {
    if (!client) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchServices(client)
      .then((rows) => {
        if (isMounted) {
          setServices(rows);
        }
      })
      .catch((caught) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Services could not load.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [client]);

  const categories = useMemo(() => ["All", ...uniqueCategories(services)], [services]);

  useEffect(() => {
    if (selectedCategoryParam && categories.includes(selectedCategoryParam)) {
      setCategory(selectedCategoryParam);
    }
  }, [categories, selectedCategoryParam]);

  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory = category === "All" || service.category === category;
      const matchesQuery =
        !normalizedQuery ||
        [service.service_name, service.summary, service.use_case, service.category]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, query, services]);

  useEffect(() => {
    if (!selectedServiceId || !services.length) {
      return;
    }

    const service = services.find((item) => item.id === Number(selectedServiceId));

    if (service) {
      setSelectedService(service);
    }
  }, [selectedServiceId, services]);

  const openService = (service: AwsService) => {
    setSelectedService(service);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("service", String(service.id));
    setSearchParams(nextParams);
  };

  const closeService = () => {
    setSelectedService(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("service");
    setSearchParams(nextParams, { replace: true });
  };

  const chooseCategory = (item: string) => {
    setCategory(item);
    const nextParams = new URLSearchParams(searchParams);

    if (item === "All") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", item);
    }

    setSearchParams(nextParams, { replace: true });
  };

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LoadingSkeleton className="h-72" />
          <LoadingSkeleton className="h-72" />
          <LoadingSkeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload wiki</Button>}
        message={error}
        title="Service wiki unavailable"
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="relative overflow-hidden p-5 md:p-7" glow="teal">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-35 lg:block">
          <img alt="" className="h-full w-full object-cover" src={featureImage} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent" />
        </div>
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/25 bg-teal-200/10 px-3 py-2 text-xs font-semibold text-teal-100">
            <BookOpen className="h-4 w-4" />
            AWS service wiki
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-6xl">
            Search the service graph.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Every card opens into a focused operating brief with CLI context,
            gotchas, docs, and cached AI enrichment when enabled.
          </p>
        </div>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-4 md:p-5">
        <label className="group relative block">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-cyan-100/80 transition group-focus-within:text-cyan-100" />
          <input
            className="min-h-16 w-full rounded-2xl border border-cyan-100/20 bg-slate-950/80 pl-14 pr-28 text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_36px_rgba(34,211,238,0.08)] outline-none transition placeholder:text-slate-400 focus:border-cyan-200/55 focus:bg-slate-950 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_42px_rgba(34,211,238,0.18)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search AWS services, use cases, categories..."
            spellCheck={false}
            value={query}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300 sm:inline-flex">
            {filteredServices.length} results
          </span>
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                category === item
                  ? "border-cyan-200/40 bg-cyan-200/14 text-cyan-50"
                  : "border-white/10 bg-white/[0.045] text-slate-400 hover:border-white/20 hover:text-white",
              )}
              key={item}
              onClick={() => chooseCategory(item)}
              type="button"
            >
              <Filter className="h-4 w-4" />
              {item}
            </button>
          ))}
        </div>
      </GlassPanel>

      {!filteredServices.length ? (
        <EmptyState
          message="No AWS services match the current search and category combination."
          title="No services found"
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service, index) => (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.025, 0.25) }}
              aria-label={`Open ${service.service_name} details`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.052] text-left backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-200/28 hover:bg-white/[0.08]"
              key={service.id}
              onClick={() => openService(service)}
              type="button"
            >
              <div className="service-visual relative h-28 border-b border-white/10">
                <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/34 px-3 py-1 text-xs font-semibold text-slate-200">
                  {service.category ?? "Uncategorized"}
                </div>
                <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold leading-tight text-white">
                    {service.service_name}
                  </h2>
                  <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300">
                    {service.mastery_level ?? 0}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-400">
                  {service.summary ?? "No summary available."}
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
                    style={{
                      width: `${Math.min(100, Math.max(0, service.mastery_level ?? 0))}%`,
                    }}
                  />
                </div>
                <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-cyan-100 transition group-hover:border-cyan-200/25 group-hover:bg-cyan-200/10">
                  <span>View details</span>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </motion.button>
          ))}
        </section>
      )}

      <AnimatePresence>
        {selectedService ? (
          <ServiceModal
            geminiKey={envStatus.env.geminiApiKey}
            key={selectedService.id}
            onClose={closeService}
            service={selectedService}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
