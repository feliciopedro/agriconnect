import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Leaf, ShoppingBag, Truck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthApi } from '../../api/auth.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Role } from '../../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode');
  const { login } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('FARMER');
  const [isFirstTime, setIsFirstTime] = useState(mode === 'register');
  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('password');

  // OTP inputs refs & state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for Resend OTP
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Mutation for Request OTP
  const requestOtpMutation = useMutation({
    mutationFn: async (fullPhone: string) => {
      return AuthApi.requestOtp(fullPhone);
    },
    onSuccess: () => {
      toast.success('Verification code sent successfully.');
      setStep(2);
      setTimer(60);
      setCanResend(false);
      setOtp(Array(6).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send verification code. Please check the number.');
    },
  });

  // Mutation for Verify OTP
  const verifyOtpMutation = useMutation({
    mutationFn: async (payload: { fullPhone: string; code: string; role?: Role }) => {
      return AuthApi.verifyOtp(payload.fullPhone, payload.code, payload.role);
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);

      if (data.user.name === 'New User') {
        navigate('/setup-profile');
      } else {
        navigate('/');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Invalid code entered. Please try again.');
      setOtp(Array(6).fill(''));
      otpRefs.current[0]?.focus();
    },
  });

  // Mutation for Password Login
  const loginPasswordMutation = useMutation({
    mutationFn: async (payload: { fullPhone: string; password: string }) => {
      return AuthApi.loginPassword(payload.fullPhone, payload.password);
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      if (data.user.name === 'New User') {
        navigate('/setup-profile');
      } else {
        navigate('/');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Invalid phone or password credentials.');
    },
  });

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    const cleanPhone = phone.trim().replace(/^0+/, '');
    const fullPhone = `+233${cleanPhone}`;

    requestOtpMutation.mutate(fullPhone);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;

    const cleanPhone = phone.trim().replace(/^0+/, '');
    const fullPhone = `+233${cleanPhone}`;

    loginPasswordMutation.mutate({ fullPhone, password });
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const completeCode = newOtp.join('');
    if (completeCode.length === 6) {
      const cleanPhone = phone.trim().replace(/^0+/, '');
      const fullPhone = `+233${cleanPhone}`;
      verifyOtpMutation.mutate({
        fullPhone,
        code: completeCode,
        role: isFirstTime ? selectedRole : undefined,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    const cleanPhone = phone.trim().replace(/^0+/, '');
    const fullPhone = `+233${cleanPhone}`;
    requestOtpMutation.mutate(fullPhone);
  };

  const formattedPhoneMask = () => {
    if (phone.length <= 4) return `+233 ${phone}`;
    return `+233 ${phone.slice(0, 3)} XXX XXX`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <Card className="w-full max-w-[420px] p-6 space-y-6 bg-white border border-[#E5E7EB] shadow-card">
        {/* Header info */}
        <div className="text-center space-y-2 bg-white">
          <h2 className="text-3xl font-extrabold text-[#2D6A4F] font-display">
            AgriConnect
          </h2>
          <p className="text-sm text-text-secondary">
            Connecting Ghana's vegetable farmers, buyers, and transport providers
          </p>
        </div>

        {/* Signup/Login Toggle */}
        <div className="flex border border-border rounded-btn p-1 bg-white">
          <button
            type="button"
            onClick={() => {
              setIsFirstTime(true);
              setLoginMethod('otp');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              isFirstTime
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setIsFirstTime(false);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              !isFirstTime
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Log In
          </button>
        </div>

        {/* Tab switcher inside Log In mode */}
        {!isFirstTime && (
          <div className="flex border-b border-[#E5E7EB] p-0.5 bg-white">
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                loginMethod === 'password'
                  ? 'border-[#2D6A4F] text-[#111827] font-bold'
                  : 'border-transparent text-[#6B7280] hover:text-text-primary'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('otp')}
              className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                loginMethod === 'otp'
                  ? 'border-[#2D6A4F] text-[#111827] font-bold'
                  : 'border-transparent text-[#6B7280] hover:text-text-primary'
              }`}
            >
              OTP Code Login
            </button>
          </div>
        )}

        {isFirstTime || loginMethod === 'otp' ? (
          /* OTP FLOW */
          step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              {/* Role selector - only on signup registration flow */}
              {isFirstTime && (
                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-text-secondary">Select your platform role</label>
                  <div className="grid grid-cols-1 gap-2">
                    {/* Farmer */}
                    <div
                      onClick={() => setSelectedRole('FARMER')}
                      className={`flex items-center gap-3 p-3 border rounded-[10px] cursor-pointer transition-all duration-200 ${
                        selectedRole === 'FARMER'
                          ? 'border-primary bg-primary-light'
                          : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedRole === 'FARMER' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}>
                        <Leaf size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">I grow produce</p>
                        <p className="text-[11px] text-text-secondary">Farmer profile setup</p>
                      </div>
                    </div>

                    {/* Buyer */}
                    <div
                      onClick={() => setSelectedRole('BUYER')}
                      className={`flex items-center gap-3 p-3 border rounded-[10px] cursor-pointer transition-all duration-200 ${
                        selectedRole === 'BUYER'
                          ? 'border-primary bg-primary-light'
                          : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedRole === 'BUYER' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}>
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">I buy produce</p>
                        <p className="text-[11px] text-text-secondary">Commercial vegetable buyer</p>
                      </div>
                    </div>

                    {/* Transport */}
                    <div
                      onClick={() => setSelectedRole('TRANSPORT')}
                      className={`flex items-center gap-3 p-3 border rounded-[10px] cursor-pointer transition-all duration-200 ${
                        selectedRole === 'TRANSPORT'
                          ? 'border-primary bg-primary-light'
                          : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedRole === 'TRANSPORT' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}>
                        <Truck size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">I deliver produce</p>
                        <p className="text-[11px] text-text-secondary">Logistics & transport provider</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phone entry field */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Phone Number</label>
                <div className="relative flex items-center bg-white rounded-btn border border-border-input focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 transition-all">
                  <span className="pl-3.5 pr-2.5 py-2.5 border-r border-[#E5E7EB] text-sm font-bold text-text-secondary bg-gray-50/50 rounded-l-btn select-none">
                    +233
                  </span>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]*"
                    placeholder="24 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-3 pr-4 py-2.5 outline-none rounded-r-btn text-text-primary bg-white font-mono"
                  />
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                isLoading={requestOtpMutation.isPending}
                className="mt-2 h-11"
              >
                Send OTP
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Header info */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <ArrowLeft size={14} /> Change number
                </button>
                <h3 className="text-xl font-bold text-text-primary font-display">Enter Verification Code</h3>
                <p className="text-sm text-text-secondary">
                  Enter the 6-digit code sent to <span className="font-bold font-mono">{formattedPhoneMask()}</span>
                </p>
              </div>

              {/* Digit input cells row */}
              <div className="flex justify-between gap-1 sm:gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    maxLength={1}
                    required
                    pattern="[0-9]*"
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="w-12 h-[52px] bg-white border border-[#D1D5DB] rounded-[10px] text-center text-2xl font-bold text-text-primary focus:border-primary focus:ring-[3px] focus:ring-primary/15 outline-none transition-all font-mono"
                  />
                ))}
              </div>

              {/* Resend status timer link details */}
              <div className="text-center pt-2">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Resend OTP Code
                  </button>
                ) : (
                  <span className="text-xs text-text-muted">
                    Resend code in <span className="font-bold font-mono">{timer}s</span>
                  </span>
                )}
              </div>

              {verifyOtpMutation.isPending && (
                <div className="flex items-center justify-center py-2 text-sm text-primary font-semibold gap-2">
                  <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span>Verifying code...</span>
                </div>
              )}
            </div>
          )
        ) : (
          /* PASSWORD FLOW */
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            {/* Phone entry field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Phone Number</label>
              <div className="relative flex items-center bg-white rounded-btn border border-border-input focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 transition-all">
                <span className="pl-3.5 pr-2.5 py-2.5 border-r border-[#E5E7EB] text-sm font-bold text-text-secondary bg-gray-50/50 rounded-l-btn select-none">
                  +233
                </span>
                <input
                  type="tel"
                  required
                  pattern="[0-9]*"
                  placeholder="24 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-3 pr-4 py-2.5 outline-none rounded-r-btn text-text-primary bg-white font-mono"
                />
              </div>
            </div>

            {/* Password entry field */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Password</label>
              <input
                type="password"
                required
                placeholder="Enter password (e.g. password123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input font-mono text-sm py-2.5 h-11"
              />
            </div>

            <Button
              type="submit"
              fullWidth
              isLoading={loginPasswordMutation.isPending}
              className="mt-2 h-11"
            >
              Log In
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
export default LoginPage;
