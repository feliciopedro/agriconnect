import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthApi } from '../../api/auth.api';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Smartphone, Lock, AlertTriangle, Key, Copy, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English', subtitle: 'Borɔfo' },
  { code: 'tw', name: 'Twi', subtitle: 'Akan' },
  { code: 'ew', name: 'Ewe', subtitle: 'Volta Region' },
  { code: 'ha', name: 'Hausa', subtitle: 'Northern Ghana' },
];

const SHORTCODES = [
  { code: '*384*26832#', label: 'Main menu' },
  { code: '*384*26832*1#', label: 'List produce quickly (farmers)' },
  { code: '*384*26832*3#', label: 'Check your orders' },
  { code: '*384*26832*6#', label: 'Check your balance' },
];

export const ProfilePage: React.FC = () => {
  const { user, login } = useAuth();
  const [selectedLang, setSelectedLang] = useState<string>(user?.preferredLanguage || 'en');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // PIN modal states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Mutation for updating profile language preference
  const updateLangMutation = useMutation({
    mutationFn: async (lang: string) => {
      return AuthApi.updateProfile({ preferredLanguage: lang });
    },
    onSuccess: (updatedUser) => {
      const storedToken = localStorage.getItem('token') || '';
      login(storedToken, updatedUser);
      
      const langName = LANGUAGES.find((l) => l.code === selectedLang)?.name || 'English';
      toast.success(`Language preference saved. Your USSD menus will now appear in ${langName}.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update preferred language.');
    },
  });

  // Mutation for updating profile USSD PIN
  const updatePinMutation = useMutation({
    mutationFn: async (newPin: string) => {
      return AuthApi.updateProfile({ ussdPin: newPin });
    },
    onSuccess: (updatedUser) => {
      const storedToken = localStorage.getItem('token') || '';
      login(storedToken, updatedUser);

      toast.success('USSD PIN saved successfully!');
      setIsPinModalOpen(false);
      setPin('');
      setConfirmPin('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update USSD PIN.');
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSaveLanguage = () => {
    updateLangMutation.mutate(selectedLang);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error('USSD PIN must be a 4-digit numeric code');
      return;
    }
    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    updatePinMutation.mutate(pin);
  };

  const formatPinDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isPinSet = !!user?.ussdPinSetAt;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-white text-slate-800">
      
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Smartphone className="w-8 h-8 text-emerald-600" />
          My Profile & Settings
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your personal details, preferred USSD interface, and security credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Language selector */}
        <div className="space-y-8">
          
          {/* Language preference selection */}
          <SectionCard
            title="USSD & SMS Settings"
            subtitle="Choose your preferred language for offline USSD dialing and automated SMS alerts."
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setSelectedLang(lang.code)}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition-all duration-200 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-bold block">{lang.name}</span>
                      <span className={`text-xs block ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {lang.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveLanguage}
                  isLoading={updateLangMutation.isPending}
                  className="px-6"
                >
                  Save Language
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* PIN Management */}
          <SectionCard
            title="Security PIN"
            subtitle="Secure your account transactions and listing operations carried out via USSD."
          >
            {isPinSet ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">USSD PIN: ****</div>
                      <div className="text-[10px] text-slate-400">
                        Configured: {formatPinDate(user?.ussdPinSetAt)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setIsPinModalOpen(true)}
                    className="text-xs text-indigo-600 font-bold"
                  >
                    Change PIN
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-850">USSD PIN Not Configured</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Set a USSD PIN to secure your account when ordering, listing, or confirming transactions via phone dials.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setIsPinModalOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    Set PIN
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

        </div>

        {/* Right Column: Shortcode shortcuts */}
        <div>
          
          <SectionCard
            title="Your USSD Shortcuts"
            subtitle="Dial these codes from your phone to manage your AgriConnect features offline."
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-normal">
                These shortcuts work on any phone network in Ghana (MTN, Telecel, AT) and do not consume mobile internet data bundles.
              </p>

              <div className="space-y-3">
                {SHORTCODES.map((shortcut) => (
                  <div
                    key={shortcut.code}
                    className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        {shortcut.label}
                      </span>
                      <span className="font-mono text-sm font-black text-slate-700">
                        {shortcut.code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(shortcut.code)}
                      className="p-2 text-slate-400 hover:text-emerald-600 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition"
                    >
                      {copiedCode === shortcut.code ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

        </div>

      </div>

      {/* SET/CHANGE PIN MODAL */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPin('');
          setConfirmPin('');
        }}
        title={isPinSet ? 'Change USSD Security PIN' : 'Set USSD Security PIN'}
      >
        <form onSubmit={handlePinSubmit} className="space-y-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3 text-xs">
            <Key className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-slate-500 leading-normal">
              PIN must be exactly 4 digits. Avoid simple combinations like 1234 or 0000.
            </p>
          </div>

          <Input
            label="Enter 4-Digit PIN"
            type="password"
            maxLength={4}
            required
            pattern="\d{4}"
            placeholder="e.g. 8392"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="text-center font-mono tracking-[1em] text-lg font-bold"
          />

          <Input
            label="Confirm 4-Digit PIN"
            type="password"
            maxLength={4}
            required
            pattern="\d{4}"
            placeholder="e.g. 8392"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="text-center font-mono tracking-[1em] text-lg font-bold"
          />

          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsPinModalOpen(false);
                setPin('');
                setConfirmPin('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={updatePinMutation.isPending}
            >
              Save PIN
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default ProfilePage;
