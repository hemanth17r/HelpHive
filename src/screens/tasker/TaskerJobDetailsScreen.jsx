import React, { useState, useContext } from 'react';
import { MapPin, Phone, MessageSquare, ShieldCheck, CheckCircle2, User, Compass } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import { SKILLS } from '../../data/mockData';
import Tooltip from '../../components/Tooltip';
import MapView from '../../components/MapView';
import BirdAvatar from '../../components/BirdAvatars';
import { api } from '../../services/api';
import { trackEvent, EVENTS } from '../../utils/eventTracker';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const TaskerJobDetailsScreen = () => {
  const { 
    acceptedJob, 
    completeJob, 
    otpGenerated, 
    trackingTaskerPos,
    userProfile,
    role
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  const [otp, setOtp] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  React.useEffect(() => {
    if (acceptedJob && userProfile) {
      trackEvent(EVENTS.TASK_VIEWED, { userId: userProfile.id, role, entityId: acceptedJob.id });
    }
  }, [acceptedJob, userProfile, role]);

  if (!acceptedJob) return null;

  const skill = SKILLS.find(s => s.id === acceptedJob.skillId);
  const Icon = skill ? skill.icon : SKILLS[SKILLS.length - 1].icon;

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 4) {
      setErrorMsg('Please enter a valid 4-digit OTP.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    // E2E mock bypass
    if (localStorage.getItem('mock_otp') && otp === localStorage.getItem('mock_otp')) {
      setIsVerified(true);
      setIsVerifying(false);
      return;
    }

    const { data, error } = await api.verifyJobOtp(acceptedJob.id, otp);

    setIsVerifying(false);
    
    if (error) {
      console.error('OTP Verification Error:', error);
      setErrorMsg('Error verifying OTP. Please try again.');
    } else if (data === true) {
      setIsVerified(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Incorrect OTP. Please try again.');
    }
  };

  const handleComplete = () => {
    if (!isVerified) return;
    completeJob(acceptedJob.id);
  };

  const handleWhatsAppCustomer = () => {
    const taskTitle = skill?.label || acceptedJob.description || 'Task';
    const message = `Hi ${acceptedJob.address?.contactName || acceptedJob.posterName || 'Customer'},\n\nI'm contacting you regarding our HelpHive task.\n\nTask ID: ${acceptedJob.id || 'N/A'}\nTask: ${taskTitle}\n\nMessage: `;
    const posterPhone = acceptedJob.address?.contactPhone || acceptedJob.posterPhone;
    
    if (!posterPhone) {
      showToast('Customer phone number is unavailable.', 'error');
      return;
    }
    
    let cleanPhone = posterPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };


  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-6 overflow-y-auto select-none">
      
      {/* Header */}
      <div className="text-center pb-3 border-b border-border shrink-0">
        <span className="text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase">
          Active Engagement
        </span>
        <h2 className="text-base font-extrabold text-dark mt-2">Job in Progress</h2>
      </div>

      {/* Main details */}
      <div className="flex-1 space-y-4.5 my-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left">
        
        {/* Job Poster Details */}
        <div className="flex items-center justify-between bg-gray-50 border border-border p-4 rounded-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full border border-primary/20 overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
              <BirdAvatar birdName={acceptedJob.posterBird || 'falcon'} size={48} />
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-gray-400">Customer</h3>
              <p className="text-sm font-black text-dark leading-tight">{acceptedJob.posterName || acceptedJob.address?.contactName || 'Customer'}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Tooltip text="WhatsApp Customer">
              <button onClick={handleWhatsAppCustomer} className="flex items-center space-x-1.5 p-2 px-3 rounded-xl bg-white border border-border text-green-600 hover:bg-green-50 hover:border-green-200 cursor-pointer transition-colors">
                <WhatsAppIcon className="w-4 h-4" />
                <span className="text-xs font-bold">Contact</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Address Details */}
        {acceptedJob.address && (
          <div className="bg-gray-50 border border-border rounded-2xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-gray-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Service Address</span>
            </div>
            <p className="text-sm font-bold text-dark leading-tight">
              {acceptedJob.address.completeAddress}
            </p>
            {acceptedJob.address.landmark && (
              <p className="text-xs font-semibold text-gray-500">
                Landmark: {acceptedJob.address.landmark}
              </p>
            )}
            <p className="text-xs font-semibold text-gray-500">
              {acceptedJob.address.area}, {acceptedJob.address.city}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center space-x-2 text-xs font-bold text-dark">
               <Phone className="w-3.5 h-3.5 text-gray-400" />
               <span>Contact: {acceptedJob.address.contactPhone}</span>
            </div>
          </div>
        )}

        {/* Task Details */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-gray-400">
            <Icon className="w-4 h-4 text-primary" />
            <span>{skill?.label || 'Task Details'}</span>
          </div>
          <p className="text-xs font-bold text-dark leading-relaxed">
            {acceptedJob.description}
          </p>
          <div className="bg-primary/5 rounded-xl px-3 py-1.5 border border-primary/10 inline-block">
            <span className="text-[11px] font-extrabold text-primary">Offered Payout: ₹{acceptedJob.amount}</span>
          </div>
        </div>

        {/* Live Map with moving marker */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400">
            <span>Live Location</span>
            <span className="text-primary animate-pulse font-extrabold uppercase">
              Active
            </span>
          </div>
          
          <MapView 
            jobLocation={{ lat: acceptedJob.lat || 31.2560, lng: acceptedJob.lng || 75.7051 }}
            taskerLocation={trackingTaskerPos}
            taskerBirdName={userProfile?.bird || 'falcon'}
            height="180px"
          />
        </div>

        {/* Verification System */}
        <div className="bg-gray-50 border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-dark">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <span>Verify OTP to Start Job</span>
          </div>
          <p className="text-[10px] text-gray-400 font-semibold leading-normal">
            Enter the 4-digit code generated by the customer to start the task.
          </p>
          
          {isVerified ? (
            <div className="flex items-center space-x-2 bg-green-50 text-green-600 border border-green-200 p-3 rounded-xl font-bold text-xs animate-scale-up">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>OTP Verified! Proceed to start/complete the task.</span>
            </div>
          ) : (
            <div className="space-y-2 animate-scale-up">
              <div className="flex space-x-2">
                <input
                  type="text"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter OTP"
                  className="flex-1 bg-white border border-border focus:border-primary rounded-xl px-4 py-2.5 text-center font-bold tracking-widest outline-hidden text-sm text-dark"
                />
                <Tooltip text="Verify OTP code">
                  <button
                    onClick={handleVerifyOtp}
                    disabled={isVerifying}
                    className={`bg-primary hover:bg-primary/95 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </Tooltip>
              </div>
              {errorMsg && (
                <p className="text-[10px] text-red-500 font-bold">{errorMsg}</p>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Complete Button Footer */}
      <div className="max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full pt-4 shrink-0">
        <Tooltip text={isVerified ? "Mark task as fully completed" : "Please verify OTP to unlock"}>
          <button
            disabled={!isVerified}
            onClick={handleComplete}
            className={`w-full flex items-center justify-center space-x-2 font-black py-4 px-6 rounded-2xl transition-all ${
              isVerified 
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 active:scale-[0.99] cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 animate-pulse" />
            <span>Mark Task Complete</span>
          </button>
        </Tooltip>
      </div>

    </div>
  );
};

export default TaskerJobDetailsScreen;
