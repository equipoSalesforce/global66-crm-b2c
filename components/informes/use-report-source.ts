"use client";

import { refreshReportSource } from "@/lib/informes-metadata-provider";
import type { ReportSource } from "@/lib/informes-api";
import { useEffect, useState } from "react";

export function useReportSource(sourceId: ReportSource) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    refreshReportSource(sourceId).then((updated) => {
      if (active && updated) setRevision((current) => current + 1);
    });
    return () => { active = false; };
  }, [sourceId]);
  return revision;
}
