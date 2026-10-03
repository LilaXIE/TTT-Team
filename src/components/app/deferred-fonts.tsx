"use client";

import { useEffect } from "react";

/** 中文字体很大，等页面先出来再加载，避免挡住第一次打开。 */
export function DeferredFonts() {
  useEffect(() => {
    void import("misans/lib/Normal/MiSansVF.min.css");
    void import("lxgw-wenkai-webfont/lxgwwenkai-regular.css");
  }, []);
  return null;
}
