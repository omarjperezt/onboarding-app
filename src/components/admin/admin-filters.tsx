"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Filter, Building2, MapPin } from "lucide-react";

interface Cluster {
  id: string;
  name: string;
  country: string;
}

const countryLabels: Record<string, string> = {
  VE: "Venezuela",
  CO: "Colombia",
  AR: "Argentina",
};

export function AdminFilters({ clusters }: { clusters: Cluster[] }) {
  const [mounted, setMounted] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(
    new Set()
  );
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const countries = [...new Set(clusters.map((c) => c.country))];

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filtros:</span>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
          <Building2 className="h-3.5 w-3.5" />
          Cluster
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
          <MapPin className="h-3.5 w-3.5" />
          Pais
        </Button>
      </div>
    );
  }

  function toggleCluster(id: string) {
    setSelectedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCountry(code: string) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const activeFilterCount = selectedClusters.size + selectedCountries.size;

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Filtros:</span>

      {/* Cluster filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            Cluster
            {selectedClusters.size > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selectedClusters.size}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs">
            Filtrar por cluster
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clusters.map((cluster) => (
            <DropdownMenuCheckboxItem
              key={cluster.id}
              checked={selectedClusters.has(cluster.id)}
              onCheckedChange={() => toggleCluster(cluster.id)}
              className="text-xs"
            >
              {cluster.name} ({cluster.country})
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Country filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            Pais
            {selectedCountries.size > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selectedCountries.size}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs">
            Filtrar por pais
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {countries.map((code) => (
            <DropdownMenuCheckboxItem
              key={code}
              checked={selectedCountries.has(code)}
              onCheckedChange={() => toggleCountry(code)}
              className="text-xs"
            >
              {countryLabels[code] ?? code}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => {
            setSelectedClusters(new Set());
            setSelectedCountries(new Set());
          }}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
