import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react';

// 弹窗类型
type AlertType = 'success' | 'error' | 'warning' | 'info';

// 弹窗选项
interface AlertOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  duration?: number; // 自动关闭时间，0表示不自动关闭
}

// 弹窗状态
interface AlertState {
  message: string;
  type: AlertType;
  options: AlertOptions;
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

// 上下文类型
interface AlertContextType {
  alertState: AlertState;
  setAlertState: React.Dispatch<React.SetStateAction<AlertState>>;
  showAlert: (message: string, type?: AlertType, options?: AlertOptions) => void;
  showConfirm: (message: string, type?: AlertType, options?: AlertOptions) => Promise<boolean>;
}

// 创建上下文
const AlertContext = createContext<AlertContextType | undefined>(undefined);

// 图标映射
const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info
};

// 颜色映射
const colors = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600'
};

// 背景色映射
const bgColors = {
  success: 'bg-emerald-50 border-emerald-100',
  error: 'bg-red-50 border-red-100',
  warning: 'bg-amber-50 border-amber-100',
  info: 'bg-blue-50 border-blue-100'
};

// 自定义弹窗组件
const CustomAlert: React.FC = () => {
  // 使用上下文获取状态和更新函数
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('CustomAlert must be used within an AlertProvider');
  }
  const { alertState, setAlertState } = context;

  // 自动关闭计时器
  useEffect(() => {
    if (alertState.isOpen && alertState.options.duration && alertState.options.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, alertState.options.duration);

      return () => clearTimeout(timer);
    }
  }, [alertState.isOpen, alertState.options.duration]);

  // 关闭弹窗
  const handleClose = () => {
    setAlertState(prev => ({
      ...prev,
      isOpen: false
    }));
    // 如果是确认弹窗且未点击确认，则返回false
    if (alertState.resolve && alertState.options.cancelText) {
      alertState.resolve(false);
    }
  };

  // 确认操作
  const handleConfirm = () => {
    if (alertState.options.onConfirm) {
      alertState.options.onConfirm();
    }
    if (alertState.resolve) {
      alertState.resolve(true);
    }
    handleClose();
  };

  // 取消操作
  const handleCancel = () => {
    if (alertState.options.onCancel) {
      alertState.options.onCancel();
    }
    if (alertState.resolve) {
      alertState.resolve(false);
    }
    handleClose();
  };

  // 获取当前类型的图标组件
  const IconComponent = icons[alertState.type];

  return (
    <>
      {alertState.isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-gray-100 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            {/* 弹窗内容 */}
            <div className="p-6">
              <div className="flex items-start space-x-4">
                {/* 图标 */}
                <div className={`p-3 rounded-full border ${bgColors[alertState.type]}`}>
                  <IconComponent className={`h-6 w-6 ${colors[alertState.type]}`} />
                </div>

                {/* 标题和消息 */}
                <div className="flex-1">
                  {alertState.options.title && (
                    <h3 className="text-lg font-bold text-gray-900 mb-2 font-serif">
                      {alertState.options.title}
                    </h3>
                  )}
                  <p className="text-gray-600 whitespace-pre-line font-sans">
                    {alertState.message}
                  </p>
                </div>

                {/* 关闭按钮 */}
                {!alertState.options.cancelText && (
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* 按钮区域 */}
            {(alertState.options.cancelText || alertState.options.confirmText) && (
              <div className="flex justify-end space-x-3 p-4 border-t border-gray-100 bg-gray-50/50">
                {alertState.options.cancelText && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg transition-all shadow-sm"
                  >
                    {alertState.options.cancelText}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium`}
                  style={{
                    backgroundColor: alertState.type === 'success' ? '#059669' :
                      alertState.type === 'error' ? '#dc2626' :
                        alertState.type === 'warning' ? '#d97706' :
                          '#2563eb'
                  }}
                >
                  {alertState.options.confirmText || '确认'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// 弹窗提供者组件
export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({
    message: '',
    type: 'info',
    options: {},
    isOpen: false
  });

  // 显示信息弹窗
  const showAlert = (message: string, type: AlertType = 'info', options: AlertOptions = {}) => {
    setAlertState({
      message,
      type,
      options: {
        duration: options.duration || 0, // 默认不自动关闭
        ...options
      },
      isOpen: true
    });
  };

  // 显示确认弹窗
  const showConfirm = (message: string, type: AlertType = 'warning', options: AlertOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setAlertState({
        message,
        type,
        options: {
          duration: 0, // 确认弹窗不自动关闭
          cancelText: '取消',
          confirmText: '确认',
          ...options
        },
        isOpen: true,
        resolve
      });
    });
  };

  return (
    <AlertContext.Provider value={{ alertState, setAlertState, showAlert, showConfirm }}>
      {children}
      <CustomAlert />
    </AlertContext.Provider>
  );
};

// 自定义钩子
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return { showAlert: context.showAlert, showConfirm: context.showConfirm };
};
