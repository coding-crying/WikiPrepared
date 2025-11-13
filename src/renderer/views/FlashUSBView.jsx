import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Flash USB View
 *
 * Prepare USB drives with ZIM files and Kiwix readers
 * 4-step wizard:
 * 1. Select Drive & Check Compatibility
 * 2. Select Content (ZIMs + Kiwix readers)
 * 3. Review & Prepare (format if needed)
 * 4. Flash Progress
 */
function FlashUSBView() {
  const {
    drives,
    selectedDrive,
    setSelectedDrive,
    zimCatalog,
    addNotification,
  } = useStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedZims, setSelectedZims] = useState([]);
  const [selectedKiwix, setSelectedKiwix] = useState([]);
  const [shouldFormat, setShouldFormat] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashStatus, setFlashStatus] = useState('');

  // Drive compatibility analysis
  const [driveAnalysis, setDriveAnalysis] = useState(null);

  useEffect(() => {
    if (selectedDrive) {
      analyzeDrive(selectedDrive);
    }
  }, [selectedDrive]);

  const analyzeDrive = (drive) => {
    const analysis = {
      compatible: true,
      warnings: [],
      recommendations: [],
    };

    // Check filesystem
    const fs = drive.fileSystem?.toLowerCase() || 'unknown';
    if (fs === 'fat32') {
      analysis.warnings.push('FAT32 has 4GB file size limit - large ZIMs will fail');
      analysis.recommendations.push('Format to exFAT for best compatibility');
      analysis.compatible = false;
    } else if (fs === 'ntfs') {
      analysis.warnings.push('NTFS has limited macOS/Linux compatibility');
      analysis.recommendations.push('Consider formatting to exFAT for better cross-platform support');
    } else if (fs === 'exfat') {
      analysis.recommendations.push('✓ exFAT is ideal for cross-platform USB drives');
    } else if (fs.includes('ext')) {
      analysis.warnings.push('ext4 is not readable on Windows/macOS without drivers');
      analysis.recommendations.push('Format to exFAT for cross-platform use');
    }

    // Check space
    const freeGB = (drive.freeSpace || 0) / (1024 ** 3);
    if (freeGB < 1) {
      analysis.warnings.push(`Only ${freeGB.toFixed(2)} GB free space`);
      analysis.compatible = false;
    }

    setDriveAnalysis(analysis);
  };

  const getTotalSize = () => {
    let total = 0;
    selectedZims.forEach(zim => {
      total += zim.size || 0;
    });
    selectedKiwix.forEach(kiwix => {
      total += kiwix.size || 0;
    });
    return total;
  };

  const canProceedToStep = (step) => {
    switch (step) {
      case 2:
        return selectedDrive && driveAnalysis?.compatible;
      case 3:
        return selectedZims.length > 0 || selectedKiwix.length > 0;
      case 4:
        const totalSize = getTotalSize();
        const available = selectedDrive?.freeSpace || 0;
        return totalSize <= available;
      default:
        return true;
    }
  };

  const handleFlash = async () => {
    setFlashing(true);
    setFlashProgress(0);
    setCurrentStep(4);

    try {
      // Step 1: Format if needed
      if (shouldFormat) {
        setFlashStatus('Formatting drive to exFAT...');
        await window.electronAPI.invoke(
          IPC_CHANNELS.FLASH_FORMAT_DRIVE,
          selectedDrive.devicePath,
          'exfat',
          selectedDrive.label || 'KIWIX_USB'
        );
        setFlashProgress(10);
      }

      // Step 2: Create folder structure
      setFlashStatus('Creating folder structure...');
      await window.electronAPI.invoke(
        IPC_CHANNELS.FLASH_CREATE_STRUCTURE,
        selectedDrive.mountpoint
      );
      setFlashProgress(20);

      // Step 3: Copy ZIMs
      if (selectedZims.length > 0) {
        for (let i = 0; i < selectedZims.length; i++) {
          const zim = selectedZims[i];
          setFlashStatus(`Copying ZIM ${i + 1}/${selectedZims.length}: ${zim.filename}...`);

          await window.electronAPI.invoke(
            IPC_CHANNELS.FLASH_COPY_ZIM,
            zim.url,
            selectedDrive.mountpoint
          );

          setFlashProgress(20 + (i + 1) / selectedZims.length * 60);
        }
      }

      // Step 4: Copy Kiwix readers
      if (selectedKiwix.length > 0) {
        setFlashStatus('Downloading and copying Kiwix readers...');
        await window.electronAPI.invoke(
          IPC_CHANNELS.FLASH_COPY_KIWIX,
          selectedKiwix,
          selectedDrive.mountpoint
        );
        setFlashProgress(90);
      }

      // Step 5: Create metadata and README
      setFlashStatus('Creating metadata and README...');
      await window.electronAPI.invoke(
        IPC_CHANNELS.FLASH_CREATE_METADATA,
        selectedDrive.mountpoint,
        {
          zims: selectedZims.map(z => ({ filename: z.filename, url: z.url, size: z.size })),
          kiwix: selectedKiwix,
          createdAt: new Date().toISOString(),
          createdBy: 'Kiwix USB Updater',
        }
      );
      setFlashProgress(100);
      setFlashStatus('✓ Flash complete!');

      addNotification({
        type: 'success',
        message: 'USB drive flashed successfully!',
        details: `${selectedZims.length} ZIMs + ${selectedKiwix.length} Kiwix readers`,
        duration: 8000,
      });

    } catch (error) {
      console.error('Flash error:', error);
      setFlashStatus(`Error: ${error.message}`);
      addNotification({
        type: 'error',
        message: 'Flash failed',
        details: error.message,
      });
    } finally {
      setFlashing(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1DriveSelection
          drives={drives}
          selectedDrive={selectedDrive}
          onSelectDrive={setSelectedDrive}
          driveAnalysis={driveAnalysis}
          onNext={() => setCurrentStep(2)}
          canProceed={canProceedToStep(2)}
        />;

      case 2:
        return <Step2ContentSelection
          zimCatalog={zimCatalog}
          selectedZims={selectedZims}
          setSelectedZims={setSelectedZims}
          selectedKiwix={selectedKiwix}
          setSelectedKiwix={setSelectedKiwix}
          onBack={() => setCurrentStep(1)}
          onNext={() => setCurrentStep(3)}
          canProceed={canProceedToStep(3)}
        />;

      case 3:
        return <Step3Review
          selectedDrive={selectedDrive}
          selectedZims={selectedZims}
          selectedKiwix={selectedKiwix}
          totalSize={getTotalSize()}
          shouldFormat={shouldFormat}
          setShouldFormat={setShouldFormat}
          driveAnalysis={driveAnalysis}
          onBack={() => setCurrentStep(2)}
          onFlash={handleFlash}
          canProceed={canProceedToStep(4)}
        />;

      case 4:
        return <Step4Progress
          progress={flashProgress}
          status={flashStatus}
          flashing={flashing}
          onDone={() => {
            setCurrentStep(1);
            setSelectedZims([]);
            setSelectedKiwix([]);
            setShouldFormat(false);
          }}
        />;

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Flash USB Drive</h1>
        <p style={styles.subtitle}>
          Prepare a USB drive with ZIM files and Kiwix readers for offline use
        </p>
      </div>

      {/* Step Indicator */}
      <div style={styles.stepIndicator}>
        {[1, 2, 3, 4].map(step => (
          <div
            key={step}
            style={{
              ...styles.stepItem,
              ...(currentStep === step ? styles.stepItemActive : {}),
              ...(currentStep > step ? styles.stepItemCompleted : {}),
            }}
          >
            <div style={styles.stepNumber}>{step}</div>
            <div style={styles.stepLabel}>
              {step === 1 && 'Select Drive'}
              {step === 2 && 'Select Content'}
              {step === 3 && 'Review'}
              {step === 4 && 'Flash'}
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={styles.content}>
        {renderStep()}
      </div>
    </div>
  );
}

function Step1DriveSelection({ drives, selectedDrive, onSelectDrive, driveAnalysis, onNext, canProceed }) {
  return (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>Step 1: Select USB Drive</h2>

      {drives.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>💾</div>
          <p>No USB drives detected</p>
          <p style={styles.emptyHint}>Please plug in a USB drive</p>
        </div>
      ) : (
        <div style={styles.driveList}>
          {drives.map((drive, index) => (
            <div
              key={index}
              style={{
                ...styles.driveCard,
                ...(selectedDrive?.device === drive.device ? styles.driveCardSelected : {}),
              }}
              onClick={() => onSelectDrive(drive)}
            >
              <div style={styles.driveCardHeader}>
                <div style={styles.driveIcon}>💾</div>
                <div>
                  <div style={styles.driveName}>{drive.label || drive.displayName}</div>
                  <div style={styles.drivePath}>{drive.mountpoint}</div>
                </div>
                {selectedDrive?.device === drive.device && (
                  <div style={styles.selectedBadge}>✓ Selected</div>
                )}
              </div>
              <div style={styles.driveDetails}>
                <div>Size: {formatBytes(drive.size)}</div>
                <div>Free: {formatBytes(drive.freeSpace || 0)}</div>
                <div>Format: {drive.fileSystem || 'Unknown'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDrive && driveAnalysis && (
        <div style={styles.analysis}>
          <h3 style={styles.analysisTitle}>Drive Analysis</h3>

          {driveAnalysis.warnings.length > 0 && (
            <div style={styles.warnings}>
              {driveAnalysis.warnings.map((warning, i) => (
                <div key={i} style={styles.warning}>⚠️ {warning}</div>
              ))}
            </div>
          )}

          {driveAnalysis.recommendations.length > 0 && (
            <div style={styles.recommendations}>
              {driveAnalysis.recommendations.map((rec, i) => (
                <div key={i} style={styles.recommendation}>💡 {rec}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.stepActions}>
        <button
          style={{
            ...styles.button,
            ...(canProceed ? styles.buttonPrimary : styles.buttonDisabled),
          }}
          onClick={onNext}
          disabled={!canProceed}
        >
          Next: Select Content →
        </button>
      </div>
    </div>
  );
}

function Step2ContentSelection({ zimCatalog, selectedZims, setSelectedZims, selectedKiwix, setSelectedKiwix, onBack, onNext, canProceed }) {
  const toggleZim = (zim) => {
    if (selectedZims.find(z => z.filename === zim.filename)) {
      setSelectedZims(selectedZims.filter(z => z.filename !== zim.filename));
    } else {
      setSelectedZims([...selectedZims, zim]);
    }
  };

  const toggleKiwix = (platform) => {
    if (selectedKiwix.includes(platform)) {
      setSelectedKiwix(selectedKiwix.filter(p => p !== platform));
    } else {
      setSelectedKiwix([...selectedKiwix, platform]);
    }
  };

  return (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>Step 2: Select Content</h2>

      <div style={styles.contentSections}>
        {/* ZIM Files Section */}
        <div style={styles.contentSection}>
          <h3 style={styles.sectionTitle}>ZIM Files ({selectedZims.length} selected)</h3>
          <div style={styles.zimListCompact}>
            {zimCatalog.slice(0, 20).map((zim, index) => (
              <div key={index} style={styles.zimItemCompact}>
                <input
                  type="checkbox"
                  checked={!!selectedZims.find(z => z.filename === zim.filename)}
                  onChange={() => toggleZim(zim)}
                  style={styles.checkbox}
                />
                <div style={styles.zimInfo}>
                  <div style={styles.zimFilename}>{zim.filename}</div>
                  <div style={styles.zimSize}>{formatBytes(zim.size)}</div>
                </div>
              </div>
            ))}
            {zimCatalog.length > 20 && (
              <div style={styles.hint}>Showing first 20. Use filters in ZIM Browser for more options.</div>
            )}
          </div>
        </div>

        {/* Kiwix Readers Section */}
        <div style={styles.contentSection}>
          <h3 style={styles.sectionTitle}>Kiwix Readers ({selectedKiwix.length} selected)</h3>
          <div style={styles.kiwixList}>
            {['windows', 'linux', 'macos'].map(platform => (
              <div key={platform} style={styles.kiwixItem}>
                <input
                  type="checkbox"
                  checked={selectedKiwix.includes(platform)}
                  onChange={() => toggleKiwix(platform)}
                  style={styles.checkbox}
                />
                <div style={styles.kiwixInfo}>
                  <div style={styles.kiwixPlatform}>
                    {platform === 'windows' && '🪟 Windows'}
                    {platform === 'linux' && '🐧 Linux'}
                    {platform === 'macos' && '🍎 macOS'}
                  </div>
                  <div style={styles.kiwixDesc}>Desktop reader application</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.stepActions}>
        <button style={styles.buttonSecondary} onClick={onBack}>
          ← Back
        </button>
        <button
          style={{
            ...styles.button,
            ...(canProceed ? styles.buttonPrimary : styles.buttonDisabled),
          }}
          onClick={onNext}
          disabled={!canProceed}
        >
          Next: Review →
        </button>
      </div>
    </div>
  );
}

function Step3Review({ selectedDrive, selectedZims, selectedKiwix, totalSize, shouldFormat, setShouldFormat, driveAnalysis, onBack, onFlash, canProceed }) {
  return (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>Step 3: Review & Prepare</h2>

      <div style={styles.review}>
        <div style={styles.reviewSection}>
          <h3 style={styles.reviewTitle}>Target Drive</h3>
          <div style={styles.reviewItem}>
            <strong>{selectedDrive.label || selectedDrive.displayName}</strong>
            <div>{selectedDrive.mountpoint}</div>
            <div>Format: {selectedDrive.fileSystem}</div>
            <div>Free Space: {formatBytes(selectedDrive.freeSpace)}</div>
          </div>
        </div>

        <div style={styles.reviewSection}>
          <h3 style={styles.reviewTitle}>Content to Flash</h3>
          <div style={styles.reviewItem}>
            <div>ZIM Files: {selectedZims.length}</div>
            <div>Kiwix Readers: {selectedKiwix.length}</div>
            <div style={styles.reviewTotal}>
              <strong>Total Size: {formatBytes(totalSize)}</strong>
            </div>
          </div>
        </div>

        {driveAnalysis && !driveAnalysis.compatible && (
          <div style={styles.reviewSection}>
            <h3 style={styles.reviewTitle}>⚠️ Format Required</h3>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={shouldFormat}
                onChange={(e) => setShouldFormat(e.target.checked)}
                style={styles.checkbox}
              />
              <span>
                Format drive to exFAT (RECOMMENDED)
                <div style={styles.formatWarning}>
                  ⚠️ This will erase all data on the drive!
                </div>
              </span>
            </label>
          </div>
        )}

        {!canProceed && (
          <div style={styles.error}>
            ⚠️ Not enough space! Need {formatBytes(totalSize)}, have {formatBytes(selectedDrive.freeSpace)}
          </div>
        )}
      </div>

      <div style={styles.stepActions}>
        <button style={styles.buttonSecondary} onClick={onBack}>
          ← Back
        </button>
        <button
          style={{
            ...styles.button,
            ...(canProceed ? styles.buttonPrimary : styles.buttonDisabled),
          }}
          onClick={onFlash}
          disabled={!canProceed}
        >
          🚀 Start Flashing
        </button>
      </div>
    </div>
  );
}

function Step4Progress({ progress, status, flashing, onDone }) {
  return (
    <div style={styles.step}>
      <h2 style={styles.stepTitle}>Step 4: Flashing USB Drive</h2>

      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <div style={styles.progressText}>{progress.toFixed(0)}%</div>
        <div style={styles.progressStatus}>{status}</div>
      </div>

      {!flashing && progress === 100 && (
        <div style={styles.successMessage}>
          <div style={styles.successIcon}>✓</div>
          <h3>Flash Complete!</h3>
          <p>Your USB drive is ready to use.</p>
          <p style={styles.hint}>
            When you plug this drive in later, the app will automatically detect it
            and offer to check for updates.
          </p>
        </div>
      )}

      {!flashing && (
        <div style={styles.stepActions}>
          <button style={styles.buttonPrimary} onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '32px',
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#757575',
  },
  stepIndicator: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '32px',
    padding: '0 20px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    opacity: 0.5,
  },
  stepItemActive: {
    opacity: 1,
  },
  stepItemCompleted: {
    opacity: 0.8,
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    marginBottom: '8px',
  },
  stepLabel: {
    fontSize: '14px',
    textAlign: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '32px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  step: {
    minHeight: '400px',
  },
  stepTitle: {
    margin: '0 0 24px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#212121',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#757575',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#9e9e9e',
  },
  driveList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  driveCard: {
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  driveCardSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  driveCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  driveIcon: {
    fontSize: '32px',
  },
  driveName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#212121',
  },
  drivePath: {
    fontSize: '14px',
    color: '#757575',
  },
  selectedBadge: {
    marginLeft: 'auto',
    padding: '4px 12px',
    backgroundColor: '#2196f3',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  driveDetails: {
    display: 'flex',
    gap: '24px',
    fontSize: '14px',
    color: '#616161',
  },
  analysis: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  analysisTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  warnings: {
    marginBottom: '12px',
  },
  warning: {
    padding: '8px',
    backgroundColor: '#fff3e0',
    borderLeft: '4px solid #ff9800',
    marginBottom: '8px',
    fontSize: '14px',
  },
  recommendations: {
    marginBottom: '12px',
  },
  recommendation: {
    padding: '8px',
    backgroundColor: '#e3f2fd',
    borderLeft: '4px solid #2196f3',
    marginBottom: '8px',
    fontSize: '14px',
  },
  contentSections: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  contentSection: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
  },
  zimListCompact: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  zimItemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    borderBottom: '1px solid #f0f0f0',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  zimInfo: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zimFilename: {
    fontSize: '13px',
    color: '#424242',
  },
  zimSize: {
    fontSize: '12px',
    color: '#757575',
  },
  hint: {
    fontSize: '12px',
    color: '#9e9e9e',
    padding: '12px',
    textAlign: 'center',
  },
  kiwixList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  kiwixItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
  },
  kiwixInfo: {
    flex: 1,
  },
  kiwixPlatform: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  kiwixDesc: {
    fontSize: '13px',
    color: '#757575',
  },
  review: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  reviewSection: {
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  reviewTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  reviewItem: {
    fontSize: '14px',
    lineHeight: '1.6',
  },
  reviewTotal: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e0e0e0',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  formatWarning: {
    fontSize: '13px',
    color: '#f57c00',
    marginTop: '4px',
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    borderLeft: '4px solid #f44336',
    color: '#c62828',
    fontSize: '14px',
    fontWeight: '600',
  },
  progressContainer: {
    padding: '32px',
    textAlign: 'center',
  },
  progressBar: {
    height: '24px',
    backgroundColor: '#e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196f3',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2196f3',
    marginBottom: '8px',
  },
  progressStatus: {
    fontSize: '16px',
    color: '#616161',
  },
  successMessage: {
    textAlign: 'center',
    padding: '32px',
  },
  successIcon: {
    fontSize: '64px',
    color: '#4caf50',
    marginBottom: '16px',
  },
  stepActions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    marginTop: '32px',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
  },
  buttonPrimary: {
    backgroundColor: '#2196f3',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
    color: '#424242',
    border: '1px solid #e0e0e0',
  },
  buttonDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#9e9e9e',
    cursor: 'not-allowed',
  },
};

export default FlashUSBView;
