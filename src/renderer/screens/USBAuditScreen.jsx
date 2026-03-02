import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as ScanIcon,
  Autorenew as RefreshIcon
} from '@mui/icons-material';

import AppLayout from '../components/layout/AppLayout';
import ProgressBar from '../components/common/ProgressBar';
import { ROUTES } from '../utils/constants';
import { formatBytes } from '../utils/formatters';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useDrivesStore } from '../stores/drivesStore';
import { useToastStore } from '../stores/toastStore';

function shortHash(h) {
  if (!h) return '';
  if (h.length <= 16) return h;
  return `${h.slice(0, 8)}...${h.slice(-8)}`;
}

function statusChip(status) {
  switch (status) {
    case 'ok':
      return { label: 'OK', color: 'success' };
    case 'mismatch':
      return { label: 'Mismatch', color: 'error' };
    case 'no-checksum':
      return { label: 'No checksum', color: 'warning' };
    case 'invalid-checksum-file':
      return { label: 'Bad checksum file', color: 'warning' };
    case 'missing-file':
      return { label: 'Missing file', color: 'error' };
    case 'baseline-created':
      return { label: 'Baseline created', color: 'info' };
    case 'error':
      return { label: 'Error', color: 'error' };
    default:
      return { label: status || 'Unknown', color: 'default' };
  }
}

export default function USBAuditScreen() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();

  const selectedDrive = useAppFlowStore((s) => s.selectedDrive);
  const getDrive = useDrivesStore((s) => s.getDrive);

  const [usbPath, setUsbPath] = useState(null);

  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState(null);
  const [auditResults, setAuditResults] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);

  const [refreshRunning, setRefreshRunning] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ progress: 0, currentFile: '', speed: 0, transferredSize: 0, totalSize: 0 });

  const lastAuditUsbPathRef = useRef(null);

  // Resolve mountpoint from selected drive.
  useEffect(() => {
    if (!selectedDrive) {
      navigate(ROUTES.DRIVE_SELECTION);
      return;
    }

    const latest = getDrive(selectedDrive.device) || selectedDrive;
    const mp = latest?.mountpoints?.[0]?.path || latest?.mountpoint;
    if (!mp) {
      showToast('Selected drive has no mount point. Try unplugging and replugging it.', 'error');
      navigate(ROUTES.DRIVE_SELECTION);
      return;
    }

    setUsbPath(mp);
  }, [selectedDrive?.device]);

  const handleAuditProgress = useCallback((p) => {
    // Filter progress for the current USB path (when multiple windows exist).
    if (lastAuditUsbPathRef.current && p?.usbPath && p.usbPath !== lastAuditUsbPathRef.current) return;
    setAuditProgress(p);
  }, []);

  useEffect(() => {
    window.electronAPI.on('usb:audit:progress', handleAuditProgress);
    return () => {
      window.electronAPI.off('usb:audit:progress');
    };
  }, []);

  const runAudit = useCallback(async (opts = {}) => {
    if (!usbPath) return;
    setAuditRunning(true);
    setAuditProgress({ phase: 'starting', message: 'Starting audit...' });
    setAuditResults([]);
    setAuditSummary(null);

    lastAuditUsbPathRef.current = usbPath;

    try {
      const res = await window.electronAPI.invoke('usb:audit:scan', usbPath, {
        includeLargeFiles: true,
        minLargeFileBytes: 100 * 1024 * 1024,
        maxDepth: 8,
        ...opts
      });

      setAuditResults(res?.results || []);
      setAuditSummary(res?.summary || null);
      showToast('USB audit complete', 'success', 3000);
    } catch (e) {
      console.error('USB audit failed:', e);
      showToast(`USB audit failed: ${e.message}`, 'error', 8000);
    } finally {
      setAuditRunning(false);
    }
  }, [usbPath]);

  useEffect(() => {
    if (usbPath) runAudit();
  }, [usbPath]);

  const overallPercent = useMemo(() => {
    const p = auditProgress;
    if (!p || !p.totalFiles || !p.currentIndex) return null;
    const base = Math.max(0, p.currentIndex - 1);
    const filePart = (p.phase === 'hashing' && p.totalBytes > 0) ? (p.processedBytes / p.totalBytes) : 0;
    const denom = Math.max(1, p.totalFiles);
    return Math.min(100, ((base + filePart) / denom) * 100);
  }, [auditProgress]);

  const currentFileLine = useMemo(() => {
    const p = auditProgress;
    if (!p) return '';
    if (p.phase === 'discovering') return p.message || 'Scanning files...';
    if (p.phase === 'verifying') return `Verifying ${p.name || ''}`.trim();
    if (p.phase === 'hashing') return `Hashing ${p.name || ''}`.trim();
    if (p.phase === 'completed') return 'Audit complete';
    if (p.phase === 'error') return `Error: ${p.error || 'Unknown error'}`;
    return p.message || '';
  }, [auditProgress]);

  const zimsOnUsb = useMemo(() => {
    return auditResults
      .filter((r) => (r?.name || '').toLowerCase().endsWith('.zim'))
      .map((r) => r.name);
  }, [auditResults]);

  const refreshFromCache = useCallback(async () => {
    if (!usbPath) return;
    if (!zimsOnUsb.length) {
      showToast('No ZIM files found to refresh on this USB.', 'warning');
      return;
    }

    const confirmMsg =
      `This will overwrite ZIM files on the USB using your local cache (if present).\n\n` +
      `If a ZIM is missing from your local cache, the refresh will fail.\n\n` +
      `Proceed?`;

    if (!confirm(confirmMsg)) return;

    setRefreshRunning(true);
    setRefreshProgress({ progress: 0, currentFile: '', speed: 0, transferredSize: 0, totalSize: 0 });

    const onProgress = (p) => {
      setRefreshProgress({
        progress: p.progress || 0,
        currentFile: p.currentFile || '',
        speed: p.speed || 0,
        transferredSize: p.transferredSize || 0,
        totalSize: p.totalSize || 0
      });
    };

    const onCompleted = () => {
      showToast('Refresh completed. Re-run the audit to confirm integrity.', 'success', 6000);
      setRefreshRunning(false);
      window.electronAPI.off('transfer:progress');
      window.electronAPI.off('transfer:completed');
      window.electronAPI.off('transfer:error');
    };

    const onError = (err) => {
      showToast(`Refresh failed: ${err?.message || 'Unknown error'}`, 'error', 8000);
      setRefreshRunning(false);
      window.electronAPI.off('transfer:progress');
      window.electronAPI.off('transfer:completed');
      window.electronAPI.off('transfer:error');
    };

    try {
      window.electronAPI.on('transfer:progress', onProgress);
      window.electronAPI.on('transfer:completed', onCompleted);
      window.electronAPI.on('transfer:error', onError);

      await window.electronAPI.invoke('transfer:start', {
        destination: usbPath,
        filesToTransfer: zimsOnUsb,
        selectedReaders: [],
        overwriteExisting: true
      });
    } catch (e) {
      onError(e);
    }
  }, [usbPath, zimsOnUsb]);

  const handleBack = () => navigate(ROUTES.DRIVE_SELECTION);

  return (
    <AppLayout
      title="USB Audit"
      subtitle={usbPath ? `Verify integrity on: ${usbPath}` : 'Verify integrity on an existing USB stick'}
      maxWidth="md"
      currentStep={1}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<BackIcon />} onClick={handleBack}>
                Back
              </Button>
              <Button
                variant="contained"
                startIcon={<ScanIcon />}
                onClick={() => runAudit()}
                disabled={!usbPath || auditRunning || refreshRunning}
              >
                {auditRunning ? 'Auditing...' : 'Run Audit'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshFromCache}
                disabled={!usbPath || refreshRunning || auditRunning || zimsOnUsb.length === 0}
              >
                Refresh ZIMs From Cache
              </Button>
            </Box>

            {auditSummary && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Chip label={`OK: ${auditSummary.ok || 0}`} color="success" size="small" />
                <Chip label={`Mismatch: ${auditSummary.mismatch || 0}`} color="error" size="small" />
                <Chip label={`No checksum: ${auditSummary.missingChecksum || 0}`} color="warning" size="small" />
                <Chip label={`Errors: ${auditSummary.errors || 0}`} color="error" variant="outlined" size="small" />
              </Box>
            )}
          </Box>
        </Paper>

        {(auditRunning || auditProgress) && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Audit Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap title={currentFileLine}>
              {currentFileLine || 'Working...'}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <LinearProgress variant={overallPercent == null ? 'indeterminate' : 'determinate'} value={overallPercent || 0} />
              {overallPercent != null && (
                <Typography variant="caption" color="text.secondary">
                  {overallPercent.toFixed(1)}%
                </Typography>
              )}
            </Box>
          </Paper>
        )}

        {refreshRunning && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Refresh Progress
            </Typography>
            <ProgressBar
              progress={refreshProgress.progress}
              downloadedSize={refreshProgress.transferredSize}
              totalSize={refreshProgress.totalSize}
              speed={refreshProgress.speed}
              filename={refreshProgress.currentFile}
              animated={true}
            />
          </Paper>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          This audit verifies files that have a sibling <code>.sha256</code> checksum (and always includes <code>.zim</code> files).
          The refresh button overwrites ZIMs using your local cache, which can help “rewrite” the USB over time.
        </Alert>

        <Paper variant="outlined" sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Results ({auditResults.length})
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {auditResults.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {auditRunning ? 'Scanning...' : 'No results yet.'}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {auditResults.map((r) => {
                const chip = statusChip(r.status);
                return (
                  <Box
                    key={r.filePath}
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper'
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {r.name}
                      </Typography>
                      <Chip label={chip.label} color={chip.color} size="small" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {formatBytes(r.size || 0)}
                      {r.expectedSha256 ? `  expected: ${shortHash(r.expectedSha256)}` : ''}
                      {r.actualSha256 ? `  actual: ${shortHash(r.actualSha256)}` : ''}
                    </Typography>
                    {r.error && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                        {r.error}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>
    </AppLayout>
  );
}

