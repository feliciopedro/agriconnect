import React, { useState, useEffect } from 'react';
import { UssdApi } from '../../api/ussd.api';
import { toast } from 'react-hot-toast';
import { Phone, RefreshCw, Send, XCircle, Clock, MessageSquare, ShieldAlert } from 'lucide-react';

const ROLE_PRESETS = [
  { label: 'Farmer Presets', phone: '+233241234567', role: 'Farmer' },
  { label: 'Buyer Presets', phone: '+233242234567', role: 'Buyer' },
  { label: 'Transporter Presets', phone: '+233243234567', role: 'Transporter' },
];

export const UssdSimulatorPage: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>(`USSD_SIM_${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
  const [phoneNumber, setPhoneNumber] = useState<string>('+233241234567');
  const [text, setText] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');
  const [responseScreen, setResponseScreen] = useState<string>('Dial any sequence or select a preset role to start...');
  const [history, setHistory] = useState<Array<{ step: number; input: string; response: string; timestamp: Date }>>([]);
  const [smsQueue, setSmsQueue] = useState<any[]>([]);
  const [isEndSession, setIsEndSession] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize a new session ID
  const handleResetSession = () => {
    const newSession = `USSD_SIM_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    setSessionId(newSession);
    setText('');
    setResponseScreen('Dial any sequence or select a preset role to start...');
    setHistory([]);
    setIsEndSession(false);
    toast.success('Session reset successfully.');
  };

  // Fetch pending SMS queue matching our phone number
  const fetchSmsQueue = async () => {
    try {
      const data = await UssdApi.getSmsQueue();
      // Filter SMS for the current normalized test phone
      const filtered = data.filter(
        (msg: any) => msg.toPhone.replace(/^\+/, '') === phoneNumber.replace(/^\+/, '')
      );
      setSmsQueue(filtered);
    } catch (err: any) {
      console.error('Failed to fetch SMS queue:', err.message);
    }
  };

  // Simulate calling the webhook
  const handleSend = async (customText?: string) => {
    const payloadText = customText !== undefined ? customText : text;
    setLoading(true);
    try {
      const resultText = await UssdApi.simulateUssd(sessionId, phoneNumber, payloadText, language);
      
      const newResponse = resultText;
      setResponseScreen(newResponse);
      setIsEndSession(newResponse.startsWith('END'));

      setHistory((prev) => [
        ...prev,
        {
          step: prev.length + 1,
          input: payloadText || '[Dial]',
          response: newResponse,
          timestamp: new Date(),
        },
      ]);

      // If it's an END response, close session locally
      if (newResponse.startsWith('END')) {
        toast('Session completed (END received).');
      }

      // Fetch updated SMS queue
      setTimeout(fetchSmsQueue, 800);
    } catch (err: any) {
      setResponseScreen(`END Connection Error:\n${err.message}`);
      setIsEndSession(true);
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Preset configuration clicker
  const handlePresetSelect = (phone: string) => {
    setPhoneNumber(phone);
    handleResetSession();
  };

  // Phone keypad press mapping
  const handleKeyPress = (char: string) => {
    if (isEndSession) {
      toast.error('Session ended. Click Reset to start again.');
      return;
    }
    setText((prev) => prev ? prev + char : char);
  };

  // Backspace key
  const handleBackspace = () => {
    setText((prev) => {
      if (!prev) return '';
      return prev.slice(0, -1);
    });
  };

  // Direct edit changes
  const handleBufferEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  // Fetch SMS initially and whenever phone changes
  useEffect(() => {
    fetchSmsQueue();
  }, [phoneNumber]);

  // Screen text formatting to ~28 character wrapping
  const wordWrap = (str: string, width = 28) => {
    if (!str) return '';
    return str.split('\n').map((line) => {
      const regex = new RegExp(`.{1,${width}}`, 'g');
      return line.match(regex)?.join('\n') || line;
    }).join('\n');
  };

  const responseTextCleaned = responseScreen.substring(4);
  const responseType = responseScreen.substring(0, 3);
  const charLength = responseScreen.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-white min-h-screen text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Phone className="w-8 h-8 text-emerald-600 animate-bounce" />
            USSD Interactive Simulator
          </h1>
          <p className="text-slate-500 mt-1">
            Simulate and verify Africa's Talking USSD sessions, menu overrides, and outbound triggers.
          </p>
        </div>
        <button
          onClick={handleResetSession}
          className="mt-4 md:mt-0 flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Session
        </button>
      </div>

      {/* Preset configurations & selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Test Account Presets</label>
          <div className="flex gap-2 mt-1">
            {ROLE_PRESETS.map((preset) => (
              <button
                key={preset.phone}
                onClick={() => handlePresetSelect(preset.phone)}
                className={`flex-1 text-xs py-2 px-3 rounded-lg border font-semibold transition-all ${
                  phoneNumber === preset.phone
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {preset.role}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Language Override (Simulate shortcode dial)</label>
          <div className="flex gap-2 mt-1">
            {['en', 'tw', 'ew', 'ha'].map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-2 text-xs font-extrabold uppercase rounded-lg border transition-all ${
                  language === lang
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Phone Number & Session ID</label>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +233241234567"
              className="flex-1 text-xs py-2 px-3 rounded-lg border border-slate-200 text-slate-800 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[10px] font-mono text-slate-400 bg-slate-200 py-1 px-2 rounded-md">
              {sessionId.substring(9)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        
        {/* Left Column - Device Body Mockup */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex justify-center">
          <div className="w-[320px] bg-slate-900 rounded-[36px] p-6 shadow-2xl border-4 border-slate-800 flex flex-col gap-6 items-center">
            
            {/* Nokia Monospace Screen Display */}
            <div className="w-[250px] h-[190px] bg-black border-2 border-slate-700 rounded-lg p-3 flex flex-col justify-between font-mono text-xs overflow-hidden shadow-inner relative">
              <div className={`leading-tight whitespace-pre-wrap ${responseType === 'END' ? 'text-emerald-500 opacity-80' : 'text-emerald-400 font-bold'}`}>
                {wordWrap(responseTextCleaned)}
              </div>
              <div className="flex justify-between items-center text-[9px] text-emerald-600 border-t border-emerald-950 pt-1 mt-1 font-mono">
                <span>{responseType || 'INIT'}</span>
                <span className={charLength > 182 ? 'text-red-500 font-bold' : ''}>
                  {charLength}/182 chars
                </span>
              </div>
            </div>

            {/* Input Dial Buffer display */}
            <div className="w-full flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Input buffer</label>
              <textarea
                rows={1}
                value={text}
                onChange={handleBufferEdit}
                placeholder="Empty dial sequence"
                className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-md py-1.5 px-3 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
              />
            </div>

            {/* Keypad Layout */}
            <div className="grid grid-cols-3 gap-3 w-full px-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="w-full h-11 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-white rounded-lg font-bold text-sm shadow transition-all duration-100"
                >
                  {key}
                </button>
              ))}

              {/* Functional phone controllers */}
              <button
                onClick={handleBackspace}
                className="w-full h-11 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center shadow"
              >
                ⌫
              </button>
              
              <button
                onClick={() => handleSend()}
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center shadow disabled:opacity-50"
              >
                {loading ? '...' : <Send className="w-4 h-4" />}
              </button>

              <button
                onClick={handleResetSession}
                className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center justify-center shadow"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            
          </div>
        </div>

        {/* Right Column - Session Detail Panels */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Timeline & Step history */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Session Input History
            </h3>
            
            <div className="max-h-[220px] overflow-y-auto flex flex-col gap-3 pr-2">
              {history.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  No dials recorded yet in this session.
                </div>
              ) : (
                history.map((step) => {
                  const isEnd = step.response.startsWith('END');
                  return (
                    <div key={step.step} className="flex gap-4 items-start text-xs border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <span className="font-bold text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">
                        #{step.step}
                      </span>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {step.input || '[dial]'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {step.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-slate-500 font-mono text-[11px] truncate max-w-[320px]">
                            {step.response.substring(4)}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isEnd ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isEnd ? 'END' : 'CON'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Character bounds checking panel */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              Response Length Auditing
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Current Response</div>
                <div className={`text-xl font-black mt-1 ${charLength > 182 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {charLength}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Limit Bounds</div>
                <div className="text-xl font-black text-slate-800 mt-1">
                  182
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                <div className={`text-xs font-bold mt-2.5 px-2 py-1 rounded-full ${
                  charLength > 182 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {charLength > 182 ? 'LIMIT EXCEEDED' : 'COMPLIANT'}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Steps</div>
                <div className="text-xl font-black text-slate-800 mt-1">
                  {history.length}
                </div>
              </div>
            </div>
          </div>

          {/* Pending SMS Queue logs */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Pending SMS Triggers
            </h3>
            
            <div className="max-h-[220px] overflow-y-auto flex flex-col gap-3 pr-2">
              {smsQueue.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  No SMS triggered yet for this user phone number.
                </div>
              ) : (
                smsQueue.map((sms) => (
                  <div key={sms.id} className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {sms.triggerAction}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        sms.status === 'SENT'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sms.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {sms.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono italic leading-tight">
                      "{sms.message}"
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>To: {sms.toPhone}</span>
                      <span>{new Date(sms.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UssdSimulatorPage;
