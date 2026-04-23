import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createOrder, verifyPayment, handleCancellation } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const loadRazorpay = () =>
  new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { booking, slot, parking } = location.state || {};
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => { if (!booking) navigate('/'); }, [booking, navigate]);

  const handlePayment = async () => {
    setLoading(true);
    const sdkLoaded = await loadRazorpay();
    if (!sdkLoaded) { toast.error('Payment service unavailable. Please retry.'); setLoading(false); return; }

    let orderData;
    try {
      const res = await createOrder(parseInt(bookingId));
      orderData = res.data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create order');
      setLoading(false); return;
    }

    setLoading(false);
    setPaying(true);

    const razorpayKey = orderData.key_id || process.env.REACT_APP_RAZORPAY_KEY_ID;

    if (!razorpayKey) {
      toast.error('Payment configuration is incomplete. Please contact support.');
      setPaying(false);
      return;
    }

    const options = {
      key: razorpayKey,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'EasePark',
      description: `Booking ${orderData.booking_ref}`,
      order_id: orderData.order_id,
      prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
      theme: { color: '#ff4d6d' },

      handler: async (response) => {
        try {
          await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            booking_id: parseInt(bookingId),
          });
          toast.success('🎉 Booking confirmed!');
          navigate('/dashboard');
        } catch { toast.error('Payment verification failed. Contact support.'); }
        finally { setPaying(false); }
      },

      // ── SILENT CANCELLATION ─────────────────────────────────────
      // User closed the modal — no error shown, slot released in background
      modal: {
        ondismiss: async () => {
          setPaying(false);
          handleCancellation(parseInt(bookingId), orderData.order_id).catch(() => {});
          // ← No toast, no redirect, no visible error
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', async () => {
      setPaying(false);
      handleCancellation(parseInt(bookingId), orderData.order_id).catch(() => {});
      toast('Unable to process payment. You may try again.', { icon: 'ℹ️' });
    });

    rzp.open();
  };

  if (!booking) return null;

  return (
    <div className="page fade-up" style={{ maxWidth: 520 }}>
      <div className="page-head">
        <h1>Complete Payment</h1>
        <p>Secure checkout powered by Razorpay</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Payment Details</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Booking Ref', <code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6 }}>{booking.booking_ref}</code>],
              ['Parking', parking?.name],
              ['Slot', slot?.slot_number || booking.slot_number],
              ['Duration', `${booking.duration_hours}h`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{ fontSize: 13 }}>{k}</span>
                <strong style={{ fontSize: 13 }}>{v}</strong>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: 13 }}>Total</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px' }}>₹{booking.amount}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: '#f0fdf9', border: '1px solid #99f6e4', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#0f766e' }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <span>256-bit encrypted. Your payment is 100% secure.</span>
      </div>

      <button className={`btn btn-primary btn-lg btn-block${loading || paying ? ' btn-load' : ''}`}
        onClick={handlePayment} disabled={loading || paying}>
        {loading || paying ? '' : `Pay ₹${booking.amount} Securely →`}
      </button>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }}
        onClick={() => navigate(-1)} disabled={loading || paying}>
        Go Back
      </button>
    </div>
  );
}
