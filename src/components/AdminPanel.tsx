'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/db/products';
import styles from './AdminPanel.module.css';

interface AdminPanelProps {
  initialAuthenticated: boolean;
  initialConfigured: boolean;
}

const DEFAULT_IMAGE = '/images/cuenco-gres.svg';

function formatPrice(price: number): string {
  return `$ ${price.toLocaleString('es-AR')}`;
}

export function AdminPanel({
  initialAuthenticated,
  initialConfigured,
}: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [maxProducts, setMaxProducts] = useState(15);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New product form state
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImageUrl, setNewImageUrl] = useState(DEFAULT_IMAGE);
  const [newInStock, setNewInStock] = useState(true);
  const [uploadingNew, setUploadingNew] = useState(false);

  // Bot simulator state (/api/bot/test)
  const [botText, setBotText] = useState('');
  const [botImageUrl, setBotImageUrl] = useState('');
  const [botFile, setBotFile] = useState<File | null>(null);
  const [botPreviewUrl, setBotPreviewUrl] = useState<string | null>(null);
  const [botReply, setBotReply] = useState<string | null>(null);
  const [botBusy, setBotBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Edit product state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [uploadingEdit, setUploadingEdit] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/products', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = (await res.json()) as {
        products?: Product[];
        maxProducts?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar el catálogo.');
      }
      setProducts(data.products ?? []);
      if (data.maxProducts) setMaxProducts(data.maxProducts);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando piezas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      void loadProducts();
    }
  }, [authenticated, loadProducts]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Error de autenticación.');
      }
      setPassword('');
      setAuthenticated(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al ingresar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setProducts([]);
  }

  async function uploadImageFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'No se pudo subir la imagen.');
    }
    return data.url;
  }

  async function handleNewFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingNew(true);
    try {
      const url = await uploadImageFile(file);
      setNewImageUrl(url);
      setSuccessMsg('Imagen subida a Blob lista para guardar.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error subiendo imagen.');
    } finally {
      setUploadingNew(false);
    }
  }

  async function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingEdit(true);
    try {
      const url = await uploadImageFile(file);
      setEditImageUrl(url);
      setSuccessMsg('Nueva imagen subida a Blob.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error subiendo imagen.');
    } finally {
      setUploadingEdit(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusyId('create');
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || null,
          price: Number(newPrice),
          image_url: newImageUrl || DEFAULT_IMAGE,
          in_stock: newInStock,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear la pieza.');
      }
      setNewTitle('');
      setNewPrice('');
      setNewDesc('');
      setNewImageUrl(DEFAULT_IMAGE);
      setNewInStock(true);
      setSuccessMsg('Pieza agregada al catálogo.');
      await loadProducts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creando pieza.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleStock(product: Product) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusyId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_stock: !product.in_stock }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el stock.');
      }
      setSuccessMsg(
        !product.in_stock ? `"${product.title}" marcada disponible.` : `"${product.title}" marcada vendida.`
      );
      await loadProducts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error actualizando stock.');
    } finally {
      setBusyId(null);
    }
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setEditTitle(product.title);
    setEditPrice(String(product.price));
    setEditDesc(product.description ?? '');
    setEditImageUrl(product.image_url);
  }

  async function handleSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc || null,
          price: Number(editPrice),
          image_url: editImageUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la edición.');
      }
      setEditingId(null);
      setSuccessMsg('Cambios guardados.');
      await loadProducts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error guardando cambios.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`¿Eliminar "${product.title}" del catálogo?`)) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusyId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar la pieza.');
      }
      setSuccessMsg(`"${product.title}" eliminada.`);
      await loadProducts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error eliminando pieza.');
    } finally {
      setBusyId(null);
    }
  }

  function selectBotFile(file: File | null) {
    if (botPreviewUrl) {
      URL.revokeObjectURL(botPreviewUrl);
    }
    setBotFile(file);
    setBotPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleBotPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgItem = items.find((item) => item.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (file) {
      e.preventDefault();
      selectBotFile(file);
      setSuccessMsg('Imagen pegada desde el portapapeles.');
    }
  }

  async function toggleRecording() {
    setErrorMsg(null);
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Tu navegador no soporta grabación de audio en vivo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const finalType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        const ext = finalType.includes('ogg') ? 'ogg' : 'webm';
        const audioFile = new File([blob], `nota-de-voz.${ext}`, { type: finalType });
        selectBotFile(audioFile);
        setSuccessMsg('Audio grabado listo para enviar al bot.');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setErrorMsg('No se pudo acceder al micrófono. Verificá los permisos.');
    }
  }

  async function handleBotTest(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBotReply(null);
    setBotBusy(true);
    try {
      const formData = new FormData();
      if (botText.trim()) formData.append('text', botText.trim());
      if (botImageUrl.trim()) formData.append('imageUrl', botImageUrl.trim());
      if (botFile) formData.append('file', botFile);

      const res = await fetch('/api/bot/test', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        action?: { intent?: string };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error ejecutando el bot.');
      }
      setBotReply(
        `[${data.action?.intent ?? 'OK'}] ${data.reply ?? 'Procesado.'}`
      );
      setBotText('');
      setBotImageUrl('');
      selectBotFile(null);
      await loadProducts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error probando el bot.');
    } finally {
      setBotBusy(false);
    }
  }

  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      setErrorMsg('No se pudo copiar el ID al portapapeles.');
    }
  }

  if (!authenticated) {
    return (
      <main className={styles.container}>
        <div className={`${styles.card} ${styles.loginBox}`}>
          <h1 className={styles.title}>Taller de Norma — Admin</h1>
          <p className={styles.subtitle}>
            Ingresá la contraseña para administrar piezas, precios y stock.
          </p>

          {!initialConfigured && (
            <div className={styles.bannerError} style={{ marginTop: '1rem' }}>
              Falta configurar <code>ADMIN_PASSWORD</code> en las variables de entorno.
            </div>
          )}

          {errorMsg && (
            <div className={styles.bannerError} style={{ marginTop: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className={styles.formGrid} style={{ marginTop: '1.25rem' }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="admin-password">
                Contraseña
              </label>
              <input
                id="admin-password"
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className={styles.topActions}>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={loading || !initialConfigured}
              >
                {loading ? 'Ingresando...' : 'Entrar al taller'}
              </button>
              <Link href="/" className={styles.linkBtn}>
                Volver al catálogo
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const count = products.length;
  const pct = Math.min(100, Math.round((count / maxProducts) * 100));
  const atLimit = count >= maxProducts;

  return (
    <main className={styles.container}>
      <header className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Administración del Taller</h1>
          <p className={styles.subtitle}>
            Control manual de piezas, precios, stock e IDs únicos.
          </p>
        </div>
        <div className={styles.topActions}>
          <Link href="/" className={styles.linkBtn}>
            Ver catálogo público
          </Link>
          <button type="button" onClick={handleLogout} className={styles.secondaryBtn}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className={styles.card} aria-label="Límite de catálogo">
        <div className={styles.trackerRow}>
          <span className={`${styles.trackerCount} ${atLimit ? styles.trackerWarn : ''}`}>
            Piezas cargadas: {count} / {maxProducts}
          </span>
          <span className={styles.subtitle}>
            {atLimit
              ? 'Tope alcanzado: al crear una nueva, se borrará la más antigua.'
              : `Espacio disponible para ${maxProducts - count} pieza(s) más.`}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressFill} ${atLimit ? styles.progressFull : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {errorMsg && (
        <div className={styles.bannerError} role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className={styles.bannerSuccess} role="status" aria-live="polite">
          {successMsg}
        </div>
      )}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Probar Bot IA (Texto, Foto o Audio)</h2>
        <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>
          Pegá una imagen con <strong>Ctrl+V</strong>, pegá una URL, subí un archivo o grabá una nota de voz en vivo.
        </p>
        <form onSubmit={handleBotTest} onPaste={handleBotPaste} className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bot-text">
              Mensaje o descripción (podés pegar una imagen acá con Ctrl+V)
            </label>
            <input
              id="bot-text"
              className={styles.input}
              value={botText}
              onChange={(e) => setBotText(e.target.value)}
              placeholder="Ej: Agregá un cuenco verde a 16000"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bot-image-url">
              URL de imagen (opcional, https://...)
            </label>
            <input
              id="bot-image-url"
              type="url"
              className={styles.input}
              value={botImageUrl}
              onChange={(e) => setBotImageUrl(e.target.value)}
              placeholder="https://..."
              disabled={botBusy || Boolean(botFile)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bot-file">
              Archivo (foto o audio) o grabación en vivo
            </label>
            <div className={styles.uploadRow}>
              <input
                id="bot-file"
                type="file"
                accept="image/*,audio/*"
                onChange={(e) => selectBotFile(e.target.files?.[0] ?? null)}
                disabled={botBusy || recording}
              />
              <button
                type="button"
                className={recording ? styles.dangerBtn : styles.secondaryBtn}
                onClick={() => void toggleRecording()}
                disabled={botBusy}
              >
                {recording ? 'Detener grabación' : 'Grabar audio'}
              </button>
              {botFile && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => selectBotFile(null)}
                  disabled={botBusy}
                >
                  Quitar adjunto
                </button>
              )}
            </div>
          </div>

          {botFile && botPreviewUrl && (
            <div>
              {botFile.type.startsWith('image/') ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={botPreviewUrl}
                  alt="Vista previa adjunta"
                  className={styles.thumb}
                />
              ) : (
                <audio controls src={botPreviewUrl} />
              )}
            </div>
          )}

          {botReply && (
            <div className={styles.bannerSuccess} role="status" aria-live="polite">
              {botReply}
            </div>
          )}
          <div>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={
                botBusy ||
                recording ||
                (!botText.trim() && !botFile && !botImageUrl.trim())
              }
            >
              {botBusy ? 'Procesando con Gemini...' : 'Enviar al Bot'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Agregar nueva pieza</h2>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={`${styles.formGrid} ${styles.formGridTwo}`}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-title">
                Nombre de la pieza
              </label>
              <input
                id="new-title"
                className={styles.input}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Cuenco de gres esmaltado"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-price">
                Precio (ARS)
              </label>
              <input
                id="new-price"
                type="number"
                min={0}
                step={1}
                className={styles.input}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="15000"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-desc">
              Descripción breve
            </label>
            <textarea
              id="new-desc"
              className={styles.textarea}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Pieza torneada a mano, esmalte satinado..."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-image-url">
              Foto (subir archivo o pegar URL)
            </label>
            <div className={styles.uploadRow}>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewFileChange}
                disabled={uploadingNew}
              />
              {uploadingNew && <span>Subiendo foto...</span>}
            </div>
            <input
              id="new-image-url"
              className={styles.input}
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={newInStock}
              onChange={(e) => setNewInStock(e.target.checked)}
            />
            Disponible en stock
          </label>

          <div>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={busyId === 'create' || uploadingNew}
            >
              {busyId === 'create' ? 'Guardando...' : 'Publicar pieza'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>
          Catálogo actual ({loading ? '...' : products.length})
        </h2>
        <div className={styles.list}>
          {products.map((product) => {
            const isEditing = editingId === product.id;
            const isBusy = busyId === product.id;

            return (
              <article key={product.id} className={styles.itemCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.title}
                  className={styles.thumb}
                />

                <div>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemTitle}>{product.title}</h3>
                    <span className={styles.itemPrice}>{formatPrice(product.price)}</span>
                  </div>

                  {product.description && (
                    <p className={styles.itemDesc}>{product.description}</p>
                  )}

                  <div className={styles.metaRow}>
                    <span
                      className={
                        product.in_stock ? styles.badgeAvailable : styles.badgeSold
                      }
                    >
                      {product.in_stock ? 'Disponible' : 'Vendida'}
                    </span>
                    <span className={styles.idPill}>ID: {product.id}</span>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => void handleCopyId(product.id)}
                    >
                      {copiedId === product.id ? 'Copiado' : 'Copiar ID'}
                    </button>
                  </div>

                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={isBusy}
                      onClick={() => void handleToggleStock(product)}
                    >
                      {product.in_stock ? 'Marcar vendida' : 'Marcar disponible'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={isBusy}
                      onClick={() =>
                        isEditing ? setEditingId(null) : startEditing(product)
                      }
                    >
                      {isEditing ? 'Cancelar edición' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      disabled={isBusy}
                      onClick={() => void handleDelete(product)}
                    >
                      Eliminar
                    </button>
                  </div>

                  {isEditing && (
                    <form
                      onSubmit={(e) => void handleSaveEdit(e, product.id)}
                      className={`${styles.formGrid} ${styles.editBox}`}
                    >
                      <div className={`${styles.formGrid} ${styles.formGridTwo}`}>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor={`edit-title-${product.id}`}>
                            Nombre
                          </label>
                          <input
                            id={`edit-title-${product.id}`}
                            className={styles.input}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor={`edit-price-${product.id}`}>
                            Precio (ARS)
                          </label>
                          <input
                            id={`edit-price-${product.id}`}
                            type="number"
                            min={0}
                            step={1}
                            className={styles.input}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`edit-desc-${product.id}`}>
                          Descripción
                        </label>
                        <textarea
                          id={`edit-desc-${product.id}`}
                          className={styles.textarea}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`edit-img-${product.id}`}>
                          Cambiar imagen
                        </label>
                        <div className={styles.uploadRow}>
                          <input
                            type="file"
                            accept="image/*"
                            aria-label={`Subir nueva imagen para ${product.title}`}
                            onChange={handleEditFileChange}
                            disabled={uploadingEdit}
                          />
                          {uploadingEdit && <span>Subiendo foto...</span>}
                        </div>
                        <input
                          id={`edit-img-${product.id}`}
                          className={styles.input}
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <button
                          type="submit"
                          className={styles.primaryBtn}
                          disabled={isBusy || uploadingEdit}
                        >
                          {isBusy ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
