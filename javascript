// مثال على استخدام النظام في خدمة حقيقية
function extendViolationDeadline(violationNumber) {
    const formData = {
        violationNumber: violationNumber,
        extensionPeriod: '30 days'
    };

    // استخدام الحارس عند الإرسال
    submitServiceWithGuard('trafficViolations', formData)
        .then(result => {
            if (result.offline) {
                console.log('تم حفظ الطلب محلياً:', result.requestId);
            } else {
                console.log('تم إرسال الطلب مباشرة');
            }
        })
        .catch(error => {
            console.error('فشل في تقديم الطلب:', error);
        });
}