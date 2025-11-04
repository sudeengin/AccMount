# Otomatik Bakiye Düzeltme Sistemi

**Tarih:** 4 Kasım 2025  
**Durum:** ✅ Aktif

---

## 📌 Özet

Borç transferlerinden kaynaklanan bakiye uyumsuzlukları artık **otomatik olarak** düzeltiliyor.

---

## 🔧 Nasıl Çalışıyor?

### Otomatik Düzeltme Akışı

```
┌─────────────────────────┐
│ Kullanıcı hesap açar    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Bakiye kontrol edilir   │
│ (Veritabanı vs Hesaplanan)
└───────────┬─────────────┘
            │
            ▼
       Uyumsuzluk var mı?
            │
    ┌───────┴───────┐
    │ NO            │ YES
    ▼               ▼
┌─────────┐   ┌─────────────────┐
│ Normal  │   │ Daha önce       │
│ devam   │   │ düzeltildi mi?  │
└─────────┘   └────────┬────────┘
                       │
                 ┌─────┴─────┐
                 │ NO        │ YES
                 ▼           ▼
          ┌─────────────┐  ┌──────────┐
          │ OTOMATİK    │  │ Düzeltme │
          │ DÜZELT      │  │ atla     │
          │ (sessizce)  │  └──────────┘
          └─────────────┘
```

### Kod Mantığı

```javascript
// 1. Bakiye hesapla
const storedBalance = Number(account.bakiye || 0);
const calculatedBalance = calculateFromTransactions(account);
const hasMismatch = Math.abs(storedBalance - calculatedBalance) > 0.01;

// 2. Otomatik düzelt
if (hasMismatch && !account.balanceAutoFixed) {
    await updateDoc(accountRef, {
        bakiye: calculatedBalance,
        balanceAutoFixed: true,
        lastBalanceRecalculation: serverTimestamp(),
        autoFixReason: 'debt_transfer_backfill'
    });
}
```

---

## 🎯 Özellikler

### ✅ Tek Seferlik
- Her hesap için **sadece bir kez** otomatik düzeltme yapılır
- `balanceAutoFixed: true` flag'i ile işaretlenir
- Sonraki açılışlarda tekrar düzeltme yapılmaz

### 🔇 Sessiz Çalışma
- Kullanıcıya popup veya bildirim göstermez
- Arkaplanda asenkron çalışır
- Console'da log tutar (geliştirici için)

### 📊 İzlenebilir
- Her düzeltme console'da loglanır
- Veritabanında `lastBalanceRecalculation` timestamp'i kaydedilir
- `autoFixReason` ile neden düzeltildiği belirtilir

### 🛡️ Güvenli
- Sadece 1 kuruştan büyük farklar düzeltilir (>₺0.01)
- Yuvarlama hatalarını göz ardı eder
- İşlemlerden matematiksel olarak doğru bakiye hesaplanır

---

## 🧪 Test Senaryoları

### Senaryo 1: Eski Borç Transferli Hesap

**Başlangıç Durumu:**
- Hesap: Deneme
- Veritabanı Bakiyesi: ₺200
- İşlem Geçmişi: -₺111, -₺200 (toplam -₺311)
- Fark: ₺511

**Beklenen Sonuç:**
1. Hesap açılır
2. Console: `[Auto-Fix] Bakiye uyumsuzluğu tespit edildi: Deneme`
3. Console: `[Auto-Fix] Veritabanı: 200, Hesaplanan: -311, Fark: 511`
4. Bakiye otomatik güncellenir: **₺200 → −₺311**
5. Console: `[Auto-Fix] Deneme bakiyesi otomatik düzeltildi`
6. Sayfa yenilenir, bakiye artık doğru

**Veritabanı Değişiklikleri:**
```json
{
  "bakiye": -311,
  "balanceAutoFixed": true,
  "lastBalanceRecalculation": "2025-11-04T...",
  "autoFixReason": "debt_transfer_backfill"
}
```

### Senaryo 2: Yeni Hesap (Uyumsuzluk Yok)

**Durum:**
- Hesap: YeniCari
- Bakiye: ₺0
- İşlemler: Yok
- Fark: ₺0

**Beklenen Sonuç:**
- Otomatik düzeltme **çalışmaz**
- Console log **yok**
- Normal görüntüleme

### Senaryo 3: Daha Önce Düzeltilmiş Hesap

**Durum:**
- Hesap: Deneme
- `balanceAutoFixed: true`
- Manuel yeni işlem eklendi, bakiye yine uyumsuz

**Beklenen Sonuç:**
- Otomatik düzeltme **çalışmaz** (flag var)
- Kullanıcı manuel "Sıfırla" butonu kullanmalı
- Veya flag'i kaldırıp tekrar düzeltebilir

---

## 🔍 Console Logları

### Normal Düzeltme

```javascript
[Auto-Fix] Bakiye uyumsuzluğu tespit edildi: Deneme. Otomatik düzeltiliyor...
[Auto-Fix] Veritabanı: 200, Hesaplanan: -311, Fark: 511
[Auto-Fix] Deneme bakiyesi otomatik düzeltildi: 200 → -311
```

### Hata Durumu

```javascript
[Auto-Fix] Bakiye uyumsuzluğu tespit edildi: Deneme. Otomatik düzeltiliyor...
[Auto-Fix] Veritabanı: 200, Hesaplanan: -311, Fark: 511
[Auto-Fix] Bakiye düzeltme hatası: Error: Permission denied
```

---

## 🚨 Sorun Giderme

### Problem: Bakiye hala yanlış

**Çözüm 1: Flag'i kontrol edin**
```javascript
// Firebase Console'da hesabı açın
// Eğer balanceAutoFixed: true ise, false yapın
```

**Çözüm 2: Manuel düzeltme**
- "Sıfırla" butonunu kullanın
- Veya console'dan:
```javascript
// Tüm hesapları yeniden düzelt
allCariler.forEach(async (cari) => {
    await updateDoc(doc(db, 'cariler', cari.id), {
        balanceAutoFixed: false
    });
});
// Sayfayı yenileyin, hepsi otomatik düzelecek
```

### Problem: Düzeltme çok yavaş

**Sebep:** Asenkron çalışıyor, 2-3 saniye sürebilir

**Çözüm:** Sabırlı olun veya console'u açıp işlemi takip edin

### Problem: Bazı hesaplar düzelmiyor

**Muhtemel Sebepler:**
1. Network izni eksik (Firebase kuralları)
2. İşlem hesaplama hatası
3. Flag zaten set

**Debug:**
```javascript
// Console'da çalıştırın
console.log(allCariler.map(c => ({
    name: c.unvan,
    stored: c.bakiye,
    calculated: calculateBalance(c.id),
    autoFixed: c.balanceAutoFixed
})));
```

---

## 📝 Veritabanı Şeması

### Eski Format (Düzeltme Öncesi)
```json
{
  "id": "abc123",
  "unvan": "Deneme",
  "bakiye": 200
}
```

### Yeni Format (Düzeltme Sonrası)
```json
{
  "id": "abc123",
  "unvan": "Deneme",
  "bakiye": -311,
  "balanceAutoFixed": true,
  "lastBalanceRecalculation": {
    "seconds": 1730736000,
    "nanoseconds": 0
  },
  "autoFixReason": "debt_transfer_backfill"
}
```

---

## 🔄 Manuel Toplu Düzeltme (İsteğe Bağlı)

Eğer tüm hesapları bir seferde düzeltmek isterseniz:

### Yöntem 1: Console'dan Script

```javascript
// 1. Tüm flag'leri temizle
async function clearAllAutoFixFlags() {
    const batch = writeBatch(db);
    allCariler.forEach(cari => {
        const ref = doc(db, 'cariler', cari.id);
        batch.update(ref, { balanceAutoFixed: false });
    });
    await batch.commit();
    console.log('Tüm flag\'ler temizlendi. Sayfayı yenileyin.');
}

// 2. Çalıştır
await clearAllAutoFixFlags();

// 3. Sayfayı yenileyin (F5)
// 4. Her hesabı sırayla açın, otomatik düzelecek
```

### Yöntem 2: Toplu Düzeltme Script'i

```javascript
async function fixAllBalances() {
    const batch = writeBatch(db);
    let fixed = 0;
    
    allCariler.forEach(cari => {
        const storedBalance = Number(cari.bakiye || 0);
        let calculatedBalance = 0;
        
        allIslemler.forEach(islem => {
            const netChange = getCariNetChange(islem, cari.id);
            calculatedBalance += netChange;
        });
        
        const diff = Math.abs(storedBalance - calculatedBalance);
        
        if (diff > 0.01) {
            const ref = doc(db, 'cariler', cari.id);
            batch.update(ref, {
                bakiye: calculatedBalance,
                balanceAutoFixed: true,
                lastBalanceRecalculation: serverTimestamp(),
                autoFixReason: 'manual_bulk_fix'
            });
            fixed++;
            console.log(`${cari.unvan}: ${storedBalance} → ${calculatedBalance}`);
        }
    });
    
    await batch.commit();
    console.log(`${fixed} hesap düzeltildi!`);
    location.reload();
}

// Çalıştır
await fixAllBalances();
```

---

## 📚 İlgili Dosyalar

- **Ana Uygulama:** `index.html` (satır 4675-4699)
- **Bakiye Hesaplama:** `index.html` → `getCariNetChange()`
- **İşlem Filtresi:** `src/ui/views/home.view.js`
- **Borç Transfer Mantığı:** `src/utils/debt-transfer.js`

---

## ✅ Başarı Kriterleri

- [x] Tüm hesaplar otomatik kontrol ediliyor
- [x] Uyumsuzluklar sessizce düzeltiliyor
- [x] Tek seferlik düzeltme (flag ile)
- [x] Console'da izlenebilir loglar
- [x] Veritabanında audit trail
- [x] Kullanıcı müdahalesi gerektirmiyor

---

**Not:** Bu sistem tüm eski borç transferi bakiye sorunlarını otomatik çözer. Yeni borç transferleri zaten bakiyeyi doğru güncellediği için gelecekte sorun olmayacak.

