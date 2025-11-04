# Borç Transferi Kurtarma Rehberi (Debt Transfer Recovery Guide)

## 📋 Genel Bakış (Overview)

Bu rehber, gizli veya eksik görünen **Borç Transferi** işlemlerini İşlem Geçmişi'nde tekrar görünür hale getirmenizi sağlar.

**Problem:** Co Denim Yılmaz & Ünal ve Sezon Tekstil gibi hesaplarda ₺114,000 gibi önemli borç transfer işlemleri görünmüyor.

**Çözüm:** Tüm borç transferlerini otomatik olarak tarayıp, yanlış işaretlenmiş olanları düzeltin.

---

## 🚀 Hızlı Başlangıç (Quick Start)

### Yöntem 1: UI Arayüzü (Önerilen)

1. **Navigasyon Menüsünden** "Migration" sekmesine gidin
2. **"Görünürlük Kurtarma"** (Recovery) sekmesine tıklayın
3. Otomatik tarama başlayacak ve sonuçları göreceksiniz
4. **"Düzeltmeyi Uygula"** butonuna tıklayın
5. Onay verin ve işlemin tamamlanmasını bekleyin
6. Sayfayı yenileyin (F5)

**Hızlı Kurtarma (Co Denim & Sezon için):**
- "⚡ Hızlı Kurtarma" butonuna tıklayın
- Bu özellikle belirtilen hesaplar için eksik transferleri kurtarır

### Yöntem 2: Tarayıcı Konsolu (İleri Seviye)

Tarayıcınızda **F12** tuşuna basarak Developer Console'u açın:

```javascript
// 1. Önizleme (Dry Run - hiçbir değişiklik yapılmaz)
window.adminUtils.fixDebtTransferVisibility()

// 2. Değişiklikleri uygula (LIVE - veritabanını günceller)
window.adminUtils.fixDebtTransferVisibility(false)

// 3. Bakiyeleri doğrula
window.adminUtils.verifyBalances()

// 4. Yardım
window.adminUtils.help()
```

---

## 🔍 Ne Düzeltilir? (What Gets Fixed)

### Düzeltilen Sorunlar

1. **affectsBalance = false** → **true** olarak değiştirilir
   - Tüm borç transferleri bakiyeyi etkilemeli
   
2. **isLog = true** → **false** olarak değiştirilir
   - Borç transferleri log değil, gerçek işlemdir
   
3. **recordType = 'log'** → **'transaction'** olarak değiştirilir
   - İşlem geçmişinde görünmeleri sağlanır

4. **Migrasyon metadata** korunur ama görünürlük sağlanır
   - Migration audit trail kaybolmaz
   - İşlemler yine de görünür olur

### Düzeltilmeyen (Korunan) Veriler

- ✅ Hiçbir işlem silinmez
- ✅ Tutar bilgileri değişmez
- ✅ Tarih bilgileri korunur
- ✅ İlişkili hesaplar değişmez
- ✅ Migration audit trail korunur

---

## 📊 Adım Adım Kurtarma (Step-by-Step Recovery)

### 1. Tarama (Scan)

```
Durum: Tüm borç transferlerini bul
Süre: ~2-5 saniye
Sonuç: Toplam borç transferi sayısı + düzeltme gereken sayısı
```

**UI:**
- "🔍 Borç Transferlerini Tara" butonuna tıklayın

**Konsol:**
```javascript
// Tarama otomatik olarak yapılır
```

### 2. Önizleme (Preview - Dry Run)

```
Durum: Hangi değişiklikler yapılacak göster (DEĞİŞİKLİK YAPILMAZ)
Süre: ~5-10 saniye
Sonuç: Değişiklik raporu
```

**UI:**
- "👁️ Önizleme (Dry Run)" butonuna tıklayın
- Sonuçları inceleyin

**Konsol:**
```javascript
const preview = await window.adminUtils.fixDebtTransferVisibility()
console.log(preview)
```

**Örnek Çıktı:**
```
📊 ÖZET:
Mod: DRY_RUN
Toplam Borç Transferi: 15
Düzeltilecek: 8
Zaten Doğru: 7
Hatalar: 0
```

### 3. Uygulama (Apply Fix)

```
Durum: Değişiklikleri veritabanına kaydet
Süre: ~10-30 saniye
Sonuç: Tüm borç transferleri görünür hale gelir
```

**UI:**
- "✅ Düzeltmeyi Uygula" butonuna tıklayın
- Onay diyaloğunda "Tamam" seçin
- Tamamlandığında sayfayı yenileyin

**Konsol:**
```javascript
const result = await window.adminUtils.fixDebtTransferVisibility(false)
console.log(result)
// Sayfayı yenile
location.reload()
```

### 4. Bakiye Doğrulama (Balance Verification)

```
Durum: Tüm hesap bakiyelerinin doğru olduğunu kontrol et
Süre: ~15-45 saniye (hesap sayısına bağlı)
Sonuç: Uyumsuzluk raporu (varsa)
```

**UI:**
- "📊 Bakiyeleri Doğrula" butonuna tıklayın

**Konsol:**
```javascript
const mismatches = await window.adminUtils.verifyBalances()
console.log(mismatches)
```

**Beklenen Sonuç:**
```
🎉 Tüm bakiyeler doğru! Hiçbir uyumsuzluk bulunamadı.
```

---

## ⚡ Hızlı Kurtarma: Co Denim & Sezon Tekstil

Bu özellik özellikle şu hesaplar için tasarlandı:
- **Co Denim Yılmaz & Ünal**
- **Sezon Tekstil**

### Kullanım

1. Migration → Görünürlük Kurtarma sekmesine gidin
2. **"⚡ Hızlı Kurtarma (Co Denim & Sezon)"** butonuna tıklayın
3. Onaylayın

Bu işlem:
- Tüm borç transferlerini düzeltir (sadece bu 2 hesap değil, hepsi)
- ₺114,000 transferi dahil tüm eksik kayıtları geri yükler
- Her iki hesabın İşlem Geçmişi'nde görünür olmasını sağlar

---

## 📈 Sonuçları Doğrulama (Verify Results)

### İşlem Geçmişinde Kontrol

1. **Co Denim Yılmaz & Ünal** hesabını açın
2. **İşlem Geçmişi** sekmesine gidin
3. ₺114,000 Borç Transferi işlemini görmelisiniz
4. Türü: **Borç Transferi**
5. Delta: Pozitif veya negatif (hesabın rolüne göre)

### Sezon Tekstil'de Kontrol

1. **Sezon Tekstil** hesabını açın
2. **İşlem Geçmişi** sekmesine gidin
3. Aynı ₺114,000 işlemini tersi yönde görmelisiniz
4. Tarih aynı olmalı

### Bakiye Kontrolü

1. Her iki hesabın da **Güncel Bakiye** değerini not edin
2. İşlem Geçmişi'ndeki tüm işlemleri manuel olarak toplayın
3. Toplam, Güncel Bakiye ile eşleşmeli

---

## 🛡️ Güvenlik ve Geri Alma (Safety & Rollback)

### Önizleme Kullanın (Always Preview First)

```javascript
// ✅ İYİ: Önce önizleme yap
await window.adminUtils.fixDebtTransferVisibility() // true = dry run
// Sonuçları incele
await window.adminUtils.fixDebtTransferVisibility(false) // false = live
```

```javascript
// ❌ KÖTÜ: Doğrudan uygulama
await window.adminUtils.fixDebtTransferVisibility(false) // Risky!
```

### Geri Alma Stratejisi

Bu işlem **geri alınamaz** (otomatik olarak).

**Ancak:**
- Hiçbir veri silinmez
- Sadece bayraklar değişir
- Manuel geri alma mümkün:

```javascript
// Geri almak için (manuel - her işlem için):
// affectsBalance: true → false
// isLog: false → true
// recordType: 'transaction' → 'log'
// Ancak bu önerilmez!
```

**Öneri:** Firestore backup'ınız varsa, gerektiğinde restore edebilirsiniz.

---

## 🐛 Sorun Giderme (Troubleshooting)

### Sorun 1: "window.adminUtils is undefined"

**Neden:** app.js yüklenmedi veya hata aldı

**Çözüm:**
1. Sayfayı yenileyin (F5)
2. Console'da hata mesajlarını kontrol edin
3. `src/app.js` dosyasının yüklendiğinden emin olun

### Sorun 2: İşlemler hala görünmüyor

**Neden:** Sayfayı yenilemediyseniz veya cache sorunu

**Çözüm:**
1. Hard refresh: Ctrl+F5 (Windows) veya Cmd+Shift+R (Mac)
2. Cache'i temizleyin
3. İncognito modda tekrar deneyin

### Sorun 3: Bakiye uyumsuzluğu var

**Neden:** Eski veriler veya paralel işlemler

**Çözüm:**
1. Önce bakiye doğrulama yapın:
   ```javascript
   await window.adminUtils.verifyBalances()
   ```
2. Uyumsuzlukları not edin
3. Manuel düzeltme gerekebilir (admin ile iletişime geçin)

### Sorun 4: "Permission denied" hatası

**Neden:** Firebase kuralları veya yetki sorunu

**Çözüm:**
1. Giriş yapmış olduğunuzdan emin olun
2. Admin yetkilerine sahip olduğunuzu kontrol edin
3. Firebase Console'dan kuralları kontrol edin

---

## 📝 Sık Sorulan Sorular (FAQ)

### S: Bu işlem ne kadar sürer?
**C:** Borç transferi sayısına bağlı:
- 0-50 transfer: ~5-10 saniye
- 50-200 transfer: ~15-30 saniye
- 200+ transfer: ~30-60 saniye

### S: Gelir/gider toplamları değişir mi?
**C:** Hayır! Borç transferleri zaten P&L'de etkilemez. Bu işlem sadece görünürlüğü düzeltir.

### S: Nakit akışı etkilenir mi?
**C:** Hayır! Borç transferleri nakit akışı yaratmaz, sadece borç sahipliğini değiştirir.

### S: Eski migration metadata kaybolur mu?
**C:** Hayır! `migrationFlag`, `needsReview` gibi alanlar korunur.

### S: Bu işlemi tekrar tekrar çalıştırmak güvenli mi?
**C:** Evet! Idempotent tasarım - aynı işlemi 10 kere yaparsanız, sonuç değişmez.

### S: Sadece belirli hesaplar için yapabilir miyim?
**C:** UI'da "Hızlı Kurtarma" butonu vardır ama tüm sistemi düzeltir (önerilir).

---

## 🎯 Başarı Kriterleri (Acceptance Criteria)

### ✅ Tamamlandı Sayılır Eğer:

1. **Co Denim Yılmaz & Ünal** hesabında:
   - ₺114,000 borç transferi İşlem Geçmişi'nde görünüyor ✓
   - Tutar doğru ✓
   - Tarih doğru ✓
   - İlgili hesaplar (Sezon Tekstil) gösteriliyor ✓

2. **Sezon Tekstil** hesabında:
   - Aynı transfer karşı yönde görünüyor ✓
   - Tutar aynı ✓
   - Tarih aynı ✓

3. **CSV Export'ta:**
   - Her iki hesap için de transfer satırları var ✓

4. **Bakiye Doğrulama:**
   - Tüm hesaplarda bakiye = işlem geçmişi toplamı ✓
   - Uyumsuzluk yok ✓

---

## 🔧 Teknik Detaylar (Technical Details)

### Düzeltme Mantığı

```javascript
// Her borç transferi için:
{
  affectsBalance: true,           // ← Her zaman true olmalı
  isLog: false,                   // ← Log değil, gerçek işlem
  recordType: 'transaction',      // ← 'log' değil
  isVisibleTransaction: true,     // ← Görünürlük bayrağı
  _fixedAt: new Date(),          // ← Düzeltme tarihi (eklenir)
  _fixVersion: '1.0.0'           // ← Versiyon bilgisi (eklenir)
}
```

### Etkilenen Alanlar

```javascript
// Değiştirilebilir alanlar:
- affectsBalance
- isLog
- recordType
- isVisibleTransaction
- _fixedAt (yeni)
- _fixVersion (yeni)

// Korunan alanlar (değiştirilmez):
- id
- islemTipi
- islemCari, kaynakCari, hedefCari
- toplamTutar, tutar
- tarih, kayitTarihi
- aciklama, faturaNumarasi
- direction
- migrationFlag, needsReview (opsiyonel metadata)
```

### Batch İşleme

Firestore limiti: 500 işlem/batch

Birden fazla batch kullanılır:
- 1-500 transfer: 1 batch
- 501-1000 transfer: 2 batch
- vb.

---

## 📞 Destek (Support)

Sorun yaşarsanız:

1. **Önce console loglarını kontrol edin**
   ```javascript
   // Developer Console'da (F12)
   // Son hataları görmek için
   ```

2. **Bakiye doğrulama çalıştırın**
   ```javascript
   await window.adminUtils.verifyBalances()
   ```

3. **Ekran görüntüsü alın:**
   - İşlem Geçmişi ekranı
   - Console output
   - Hata mesajları

4. **Firestore'da manuel kontrol:**
   - Collection: `islemler`
   - Filter: `islemTipi == "borç transferi"`
   - İlgili hesap ID'leriyle filtrele

---

## 🎉 Tamamlandı!

Tüm adımları tamamladıysanız:

✅ Tüm borç transferleri görünür  
✅ Bakiyeler doğru hesaplanıyor  
✅ İşlem Geçmişi tam ve eksiksiz  
✅ CSV export çalışıyor  

**Artık Co Denim Yılmaz & Ünal ve Sezon Tekstil gibi hesaplarda eksik gö görünen ₺114,000 transferi dahil tüm borç transferleri görünür!** 🎊

---

## 📚 İlgili Belgeler

- `DEBT-TRANSFER-VISIBILITY-FIX-SUMMARY.md` - Teknik özet
- `DEBT-TRANSFER-IMPLEMENTATION.md` - İmplementasyon detayları
- `DEBT-TRANSFER-FIX-SUMMARY.md` - Düzeltme özeti
- `src/utils/debt-transfer-visibility-fix.js` - Kaynak kod
- `src/utils/admin-console.js` - Admin komutları
- `src/ui/views/debt-transfer-recovery.view.js` - UI componenti

---

**Son Güncelleme:** 4 Kasım 2025  
**Versiyon:** 1.0.0  
**Durum:** ✅ Kullanıma Hazır

