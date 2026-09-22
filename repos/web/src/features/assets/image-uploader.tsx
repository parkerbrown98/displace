"use client";

import { ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/problem-details";
import { getAssetDownload, getPlaceImage, getProfileImage } from "./asset-client";
import type { AssetContract, UploadProgress } from "./asset-contract";
import { uploadAsset } from "./upload-controller";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type CurrentImage = "place-banner" | "place-icon" | "profile-avatar" | "profile-banner";

interface ImageUploaderProps {
  currentImage?: CurrentImage;
  description: string;
  label: string;
  onUploaded(asset: AssetContract): Promise<void> | void;
  placeId: string;
  shape?: "landscape" | "square";
}

export function ImageUploader({
  currentImage,
  description,
  label,
  onUploaded,
  placeId,
  shape = "square",
}: ImageUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const abortController = useRef<AbortController>(null);
  const previewRequest = useRef(0);
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [progress, setProgress] = useState<UploadProgress>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!currentImage) return;
    const request = ++previewRequest.current;
    const reference = getCurrentImageReference(placeId, currentImage);
    void reference
      .then((current) => current.assetId ? getAssetDownload(placeId, current.assetId) : undefined)
      .then((download) => {
        if (previewRequest.current === request) setPreviewUrl(download?.url);
      })
      .catch((cause: unknown) => {
        if (previewRequest.current !== request) return;
        setError(cause instanceof ApiError
          ? cause.problem.detail ?? cause.problem.title
          : "The saved image could not be loaded.");
      });
    return () => { previewRequest.current += 1; };
    }, [currentImage, placeId]);

  function select(nextFile?: File) {
    previewRequest.current += 1;
    setError(undefined);
    setProgress(undefined);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    if (!nextFile) {
      setFile(undefined);
      setPreviewUrl(undefined);
      return;
    }
    if (!IMAGE_TYPES.includes(nextFile.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setError("Choose an image smaller than 25 MB.");
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setError(undefined);
    abortController.current = new AbortController();
    try {
      const asset = await uploadAsset(placeId, file, {
        onProgress: setProgress,
        signal: abortController.current.signal,
      });
      await onUploaded(asset);
      const download = await getAssetDownload(placeId, asset.id);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(download.url);
      setFile(undefined);
      if (input.current) input.current.value = "";
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setError("Upload cancelled.");
      } else if (cause instanceof ApiError) {
        setError(cause.problem.detail ?? cause.problem.title);
      } else {
        setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
      }
    } finally {
      abortController.current = null;
      setPending(false);
    }
  }

  const status = progress ? progressLabel(progress) : undefined;
  return (
    <div className="image-uploader">
      <div className={`image-uploader-preview image-uploader-preview-${shape}`}>
        {previewUrl ? (
          // Signed object-store URLs are returned by the API and may expire.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Selected upload preview" src={previewUrl} />
        ) : (
          <ImagePlus aria-hidden="true" size={28} />
        )}
      </div>
      <div className="image-uploader-content">
        <strong>{label}</strong>
        <p>{description}</p>
        <input
          accept={IMAGE_TYPES.join(",")}
          aria-label={`Choose ${label.toLowerCase()}`}
          hidden
          onChange={(event) => select(event.target.files?.[0])}
          ref={input}
          type="file"
        />
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => input.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden="true" size={16} /> Choose image
          </button>
          {file ? (
            <button
              className="primary-button"
              disabled={pending}
              onClick={() => void upload()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {pending ? "Uploading..." : progress ? "Retry upload" : "Upload image"}
            </button>
          ) : null}
          {pending ? (
            <button
              className="icon-button"
              onClick={() => abortController.current?.abort()}
              title="Cancel upload"
              type="button"
            >
              <X aria-hidden="true" size={17} />
              <span className="sr-only">Cancel upload</span>
            </button>
          ) : file ? (
            <button
              className="icon-button"
              onClick={() => select()}
              title="Remove selected image"
              type="button"
            >
              <Trash2 aria-hidden="true" size={17} />
              <span className="sr-only">Remove selected image</span>
            </button>
          ) : null}
        </div>
        {progress ? (
          <div className="upload-progress" role="status">
            <progress max={100} value={progress.percent} />
            <span>{status}</span>
          </div>
        ) : null}
        {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function progressLabel(progress: UploadProgress): string {
  if (progress.stage === "requesting") return "Preparing upload";
  if (progress.stage === "uploading") return `Uploading ${progress.percent}%`;
  if (progress.stage === "processing") return "Checking and processing image";
  return "Image ready";
}

function getCurrentImageReference(placeId: string, currentImage: CurrentImage) {
  if (currentImage === "place-banner") return getPlaceImage(placeId, "banner");
  if (currentImage === "place-icon") return getPlaceImage(placeId, "icon");
  if (currentImage === "profile-banner") return getProfileImage(placeId, "banner");
  return getProfileImage(placeId, "avatar");
}
