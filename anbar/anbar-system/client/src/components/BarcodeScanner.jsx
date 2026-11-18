import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import Modal from './Modal';

// اسکن بارکد با وبکم/دوربین لپ‌تاپ (کاملا آفلاین - کتابخانه در همان اپ باندل شده است).
// برای بارکدخوان‌های هندهلد نیازی به این کامپوننت نیست: آن دستگاه‌ها مثل صفحه‌کلید
// عمل می‌کنند و کد را مستقیما در فیلد فوکوس‌شده تایپ می‌کنند (به ورودی «بارکد سریع» مراجعه کنید).
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (result && !stopped) {
          stopped = true;
          controls.stop();
          onDetected(result.getText());
        }
      })
      .catch((e) => setError('دسترسی به دوربین ممکن نشد: ' + e.message));

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="اسکن بارکد با دوربین" onClose={onClose} width={420}>
      {error ? (
        <div className="pill pill-danger" style={{ display: 'block', padding: '10px 14px' }}>
          {error}
        </div>
      ) : (
        <>
          <video ref={videoRef} style={{ width: '100%', borderRadius: 12, background: '#000' }} muted />
          <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>
            بارکد را جلوی دوربین بگیرید تا به‌صورت خودکار شناسایی شود
          </p>
        </>
      )}
    </Modal>
  );
}
