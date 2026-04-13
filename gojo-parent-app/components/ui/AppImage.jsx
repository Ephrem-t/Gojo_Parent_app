import React, { useEffect, useMemo, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { resolveFirebaseImageUrl, shouldDeferFirebaseImageLoad } from "../../app/lib/imageUrl";

const RESIZE_MODE_TO_CONTENT_FIT = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
};

function getRawUri(uri, source) {
  if (typeof uri === "string") return uri;
  if (source && typeof source === "object" && typeof source.uri === "string") return source.uri;
  return null;
}

function getContentFit(contentFit, resizeMode) {
  if (contentFit) return contentFit;
  return RESIZE_MODE_TO_CONTENT_FIT[String(resizeMode || "").toLowerCase()] || "cover";
}

export default function AppImage({
  uri,
  source,
  fallbackSource,
  fallbackContent,
  onError,
  contentFit,
  resizeMode,
  transition = 120,
  ...props
}) {
  const rawUri = useMemo(() => {
    return getRawUri(uri, source);
  }, [uri, source]);
  const shouldDeferLoad = useMemo(() => shouldDeferFirebaseImageLoad(rawUri), [rawUri]);
  const resolvedContentFit = useMemo(() => getContentFit(contentFit, resizeMode), [contentFit, resizeMode]);

  const [resolvedSource, setResolvedSource] = useState(() => {
    if (source && !rawUri) return source;
    if (rawUri && shouldDeferLoad) return null;
    if (rawUri) return { uri: rawUri };
    return null;
  });
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let active = true;

    setUseFallback(false);

    if (source && !rawUri) {
      setResolvedSource(source);
      return () => {
        active = false;
      };
    }

    if (!rawUri) {
      setResolvedSource(null);
      return () => {
        active = false;
      };
    }

    if (shouldDeferLoad) {
      setResolvedSource(null);

      resolveFirebaseImageUrl(rawUri)
        .then((nextUri) => {
          if (!active) return;
          setResolvedSource(nextUri ? { uri: nextUri } : null);
          if (!nextUri) {
            setUseFallback(true);
          }
        })
        .catch(() => {
          if (!active) return;
          setResolvedSource(null);
          setUseFallback(true);
        });

      return () => {
        active = false;
      };
    }

    setResolvedSource({ uri: rawUri });

    resolveFirebaseImageUrl(rawUri)
      .then((nextUri) => {
        if (!active || !nextUri) return;
        setResolvedSource({ uri: nextUri });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [rawUri, shouldDeferLoad, source]);

  const handleError = (event) => {
    const currentUri = resolvedSource && typeof resolvedSource === "object" && "uri" in resolvedSource ? resolvedSource.uri : null;

    if (!shouldDeferLoad && rawUri && currentUri && currentUri !== rawUri) {
      setResolvedSource({ uri: rawUri });
      return;
    }

    setUseFallback(true);
    if (typeof onError === "function") onError(event);
  };

  if (useFallback && fallbackContent) {
    return fallbackContent;
  }

  if (useFallback && fallbackSource) {
    return <ExpoImage source={fallbackSource} contentFit={resolvedContentFit} transition={transition} {...props} />;
  }

  if (!resolvedSource) {
    if (fallbackContent) {
      return fallbackContent;
    }
    if (fallbackSource) {
      return <ExpoImage source={fallbackSource} contentFit={resolvedContentFit} transition={transition} {...props} />;
    }
    return null;
  }

  return (
    <ExpoImage
      source={resolvedSource}
      onError={handleError}
      contentFit={resolvedContentFit}
      transition={transition}
      {...props}
    />
  );
}