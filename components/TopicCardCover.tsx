"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

// The caller keys this component by source so a changed cover starts loading again.
export function TopicCardCover({
  src,
  alt,
  children,
}: {
  src: string | null;
  alt: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );

  return (
    <>
      {status !== "loaded" ? children : null}
      {src && status !== "failed" ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 760px) 100vw, 25vw"
          style={{ visibility: status === "loaded" ? "visible" : "hidden" }}
          onLoad={(event) =>
            setStatus(event.currentTarget.naturalWidth > 0 ? "loaded" : "failed")
          }
          onError={() => setStatus("failed")}
        />
      ) : null}
    </>
  );
}
