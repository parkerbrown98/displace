import { ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/ui/feedback-context';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useNativePlatform } from '../../lib/platform/platform-context';
import { useSession } from '../auth/session-provider';
import { usePlaceClient } from '../places/use-place-client';
import { imageFileError, uploadAsset, type UploadProgress } from './asset-upload';

export function PlaceImageUploader({ description, kind, label, onChanged, placeId, shape = 'square' }: {
  description: string;
  kind: 'banner' | 'icon';
  label: string;
  onChanged(): void;
  placeId: string;
  shape?: 'landscape' | 'square';
}) {
  const platform = useNativePlatform();
  const { client } = useSession();
  const placeClient = usePlaceClient();
  const notify = useToast();
  const abortRef = useRef<AbortController>(null);
  const previewRequest = useRef(0);
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [progress, setProgress] = useState<UploadProgress>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const request = ++previewRequest.current;
    void placeClient.placeImage(placeId, kind)
      .then((reference) => reference.assetId ? placeClient.assetDownload(placeId, reference.assetId) : undefined)
      .then((download) => { if (previewRequest.current === request) setPreviewUrl(download?.url); })
      .catch(() => { if (previewRequest.current === request) setPreviewUrl(undefined); });
    return () => { previewRequest.current += 1; };
  }, [kind, placeClient, placeId]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function choose() {
    const selected = (await platform.selectUploadFiles())[0];
    if (!selected) return;
    const validationError = imageFileError(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    previewRequest.current += 1;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setProgress(undefined);
    setError(undefined);
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setError(undefined);
    abortRef.current = new AbortController();
    try {
      const asset = await uploadAsset(client, placeId, file, { onProgress: setProgress, signal: abortRef.current.signal });
      await placeClient.setPlaceImage(placeId, kind, asset.id);
      const download = await placeClient.assetDownload(placeId, asset.id);
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(download.url);
      setFile(undefined);
      setProgress(undefined);
      notify(`${label} updated.`);
      onChanged();
    } catch (cause) {
      const message = cause instanceof DOMException && cause.name === 'AbortError'
        ? 'Upload cancelled.'
        : cause instanceof DesktopApiError
          ? cause.problem?.detail ?? cause.message
          : cause instanceof Error ? cause.message : `${label} could not be updated.`;
      setError(message);
      notify(message);
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }

  function removeSelection() {
    abortRef.current?.abort();
    previewRequest.current += 1;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(undefined);
    setPreviewUrl(undefined);
    setProgress(undefined);
    setError(undefined);
  }

  return <section className="place-image-uploader">
    <div className={`place-image-preview ${shape}`}>
      {previewUrl ? <img alt={`${label} preview`} src={previewUrl} /> : <ImagePlus aria-hidden="true" size={26} />}
    </div>
    <div className="place-image-uploader-copy">
      <strong>{label}</strong>
      <p>{description}</p>
      {file ? <div className="upload-file"><span>{file.name}</span><small>{formatBytes(file.size)}</small></div> : null}
      {progress ? <div className="upload-progress" role="status"><progress max={100} value={progress.percent} /><span>{progressLabel(progress)}</span></div> : null}
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div className="upload-actions">
        <button className="button secondary compact" disabled={pending} onClick={() => void choose()} type="button"><ImagePlus aria-hidden="true" size={14} />Choose image</button>
        {file ? <button className="button primary compact" disabled={pending} onClick={() => void upload()} type="button"><RefreshCw aria-hidden="true" className={pending ? 'spin' : undefined} size={14} />{pending ? 'Uploading...' : 'Upload'}</button> : null}
        {pending ? <button aria-label="Cancel upload" className="icon-button" onClick={() => abortRef.current?.abort()} title="Cancel upload" type="button"><X aria-hidden="true" size={15} /></button> : file ? <button aria-label="Remove selected image" className="icon-button" onClick={removeSelection} title="Remove selected image" type="button"><Trash2 aria-hidden="true" size={15} /></button> : null}
      </div>
    </div>
  </section>;
}

function progressLabel(progress: UploadProgress) {
  if (progress.stage === 'requesting') return 'Preparing';
  if (progress.stage === 'uploading') return `${progress.percent}%`;
  if (progress.stage === 'processing') return 'Processing';
  return 'Ready';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
