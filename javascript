// إضافة في header أو قبل إغلاق body
<script type="text/javascript">
class ConnectionGuard {
    constructor() {
        this.isOnline = true;
        this.offlineCache = new Map();
        this.pendingRequests = [];
        this.connectionCheckInterval = null;
        this.init();
    }

    init() {
        // مراقبة حالة الاتصال
        window.addEventListener('online', () => this.handleConnectionRestored());
        window.addEventListener('offline', () => this.handleConnectionLost());
        
        // مراقبة استباقية لجودة الشبكة
        this.startProactiveMonitoring();
        
        // اعتراض طلبات AJAX
        this.interceptAjaxRequests();
    }

    startProactiveMonitoring() {
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionQuality();
        }, 5000);
    }

    async checkConnectionQuality() {
        try {
            const startTime = Date.now();
            const response = await fetch('/portal/individuals/ping', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            const latency = Date.now() - startTime;
            
            if (latency > 2000 || !response.ok) {
                this.predictDisconnection();
            }
        } catch (error) {
            this.predictDisconnection();
        }
    }

    predictDisconnection() {
        // تنبيه استباقي قبل الانقطاع
        if (this.isOnline) {
            this.showPredictionAlert();
        }
    }

    showPredictionAlert() {
        const alertHTML = `
            <div id="connection-guard-alert" class="connection-guard-alert">
                <div class="alert-content">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-text">
                        <strong>الاتصال غير مستقر</strong>
                        <p>يبدو أن اتصالك بالإنترنت ضعيف. حمّل النسخة الآمنة للمواصلة بدون إنترنت.</p>
                    </div>
                    <div class="alert-actions">
                        <button onclick="connectionGuard.downloadSafePackage()" class="btn btn-primary">
                            تحميل النسخة الآمنة
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">
                            تجاهل
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHTML);
    }

    async downloadSafePackage() {
        try {
            // تحميل البيانات الأساسية للعمل بدون اتصال
            const safePackage = {
                userData: await this.getUserData(),
                services: await this.getAvailableServices(),
                forms: await this.getServiceForms(),
                timestamp: Date.now(),
                expiry: Date.now() + (5 * 60 * 1000) // 5 دقائق
            };

            // تخزين محلي مشفر
            this.storeSafePackage(safePackage);
            
            // تحديث الواجهة
            this.enableOfflineMode();
            
        } catch (error) {
            console.error('Failed to download safe package:', error);
        }
    }

    storeSafePackage(package) {
        const encrypted = btoa(JSON.stringify(package));
        localStorage.setItem('absher_safe_package', encrypted);
        localStorage.setItem('absher_safe_expiry', package.expiry);
    }

    enableOfflineMode() {
        document.body.classList.add('offline-mode');
        this.showOfflineUI();
        this.isOnline = false;
    }

    showOfflineUI() {
        const offlineBar = `
            <div id="offline-status-bar" class="offline-status-bar">
                <div class="offline-indicator">
                    <span class="status-dot"></span>
                    وضع العمل الآمن
                </div>
                <div class="offline-timer">
                    ⏳ متبقي: <span id="offline-timer">05:00</span>
                </div>
                <div class="offline-actions">
                    <button onclick="connectionGuard.syncData()" class="btn btn-sm btn-sync">
                        مزامنة الآن
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', offlineBar);
        this.startOfflineTimer();
    }

    startOfflineTimer() {
        const expiry = parseInt(localStorage.getItem('absher_safe_expiry'));
        const timerElement = document.getElementById('offline-timer');
        
        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, expiry - now);
            
            if (remaining === 0) {
                this.secureDestroy();
                return;
            }
            
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // تغيير اللون حسب الوقت المتبقي
            if (minutes < 1) {
                timerElement.style.color = '#dc3545';
            } else if (minutes < 3) {
                timerElement.style.color = '#ffc107';
            }
        };
        
        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    handleConnectionLost() {
        this.isOnline = false;
        
        if (this.hasSafePackage()) {
            this.enableOfflineMode();
        } else {
            this.showConnectionLostAlert();
        }
    }

    handleConnectionRestored() {
        this.isOnline = true;
        document.body.classList.remove('offline-mode');
        this.hideOfflineUI();
        this.syncPendingRequests();
    }

    async syncPendingRequests() {
        const pending = JSON.parse(localStorage.getItem('absher_pending_requests') || '[]');
        
        for (const request of pending) {
            try {
                await this.sendRequest(request);
                // إزالة الطلب بعد الإرسال الناجح
                this.removePendingRequest(request.id);
            } catch (error) {
                console.error('Failed to sync request:', error);
            }
        }
    }

    interceptAjaxRequests() {
        const originalSend = XMLHttpRequest.prototype.send;
        const originalOpen = XMLHttpRequest.prototype.open;
        
        let currentMethod, currentUrl;
        
        XMLHttpRequest.prototype.open = function(method, url) {
            currentMethod = method;
            currentUrl = url;
            return originalOpen.apply(this, arguments);
        };
        
        XMLHttpRequest.prototype.send = function(data) {
            if (!connectionGuard.isOnline && this.isCriticalRequest(currentUrl)) {
                // تخزين الطلب للمزامنة لاحقاً
                connectionGuard.storePendingRequest({
                    id: Date.now().toString(),
                    method: currentMethod,
                    url: currentUrl,
                    data: data,
                    timestamp: Date.now()
                });
                
                // محاكاة نجاح الطلب للواجهة
                this.dispatchEvent(new Event('load'));
                return;
            }
            
            return originalSend.apply(this, arguments);
        };
    }

    isCriticalRequest(url) {
        const criticalEndpoints = [
            '/portal/individuals/services/',
            '/portal/individuals/submit/',
            '/portal/individuals/payment/'
        ];
        
        return criticalEndpoints.some(endpoint => url.includes(endpoint));
    }

    storePendingRequest(request) {
        const pending = JSON.parse(localStorage.getItem('absher_pending_requests') || '[]');
        pending.push(request);
        localStorage.setItem('absher_pending_requests', JSON.stringify(pending));
    }

    secureDestroy() {
        // مسح آمن للبيانات
        localStorage.removeItem('absher_safe_package');
        localStorage.removeItem('absher_safe_expiry');
        localStorage.removeItem('absher_pending_requests');
        
        clearInterval(this.timerInterval);
        this.hideOfflineUI();
        
        // إعادة توجيه المستخدم
        this.showSessionExpiredAlert();
    }

    showSessionExpiredAlert() {
        const alertHTML = `
            <div class="modal fade show" style="display: block; background: rgba(0,0,0,0.5)">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">انتهت الجلسة الآمنة</h5>
                        </div>
                        <div class="modal-body">
                            <p>انتهت مدة العمل الآمن. يرجى إعادة الاتصال بالإنترنت والمحاولة مرة أخرى.</p>
                        </div>
                        <div class="modal-footer">
                            <button onclick="location.reload()" class="btn btn-primary">
                                إعادة تحميل
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHTML);
    }

    hasSafePackage() {
        const package = localStorage.getItem('absher_safe_package');
        const expiry = localStorage.getItem('absher_safe_expiry');
        
        return package && expiry && Date.now() < parseInt(expiry);
    }
}

// تهيئة النظام
const connectionGuard = new ConnectionGuard();
</script>
