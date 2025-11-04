# 🚀 Hızlı Başlangıç: Borç Transferi Kurtarma

## ⚡ 60 Saniyede Kurtarma

### Yöntem 1: Tek Tıkla (En Kolay) ✨

1. **Uygulamayı açın**
2. **"Migration"** sekmesine gidin (sol menüde)
3. **"Görünürlük Kurtarma"** tab'ına tıklayın
4. **"⚡ Hızlı Kurtarma (Co Denim & Sezon)"** butonuna tıklayın
5. **"Tamam"** deyin
6. **F5** ile sayfayı yenileyin

✅ **Tamamlandı!** Co Denim ve Sezon hesaplarında ₺114,000 transfer artık görünür.

---

### Yöntem 2: Konsol (İleri Seviye) 💻

1. **F12** tuşuna basın (Developer Console)
2. Şu komutu yazın:
   ```javascript
   await window.adminUtils.fixDebtTransferVisibility(false)
   ```
3. **Enter** tuşuna basın
4. İşlem tamamlanana kadar bekleyin
5. **F5** ile sayfayı yenileyin

✅ **Tamamlandı!** Tüm gizli borç transferleri kurtarıldı.

---

## 📋 Kontrol Listesi

İşlem sonrası kontrol edin:

### Co Denim Yılmaz & Ünal
- [ ] Hesabı açın
- [ ] "İşlem Geçmişi" sekmesine gidin
- [ ] ₺114,000 Borç Transferi görünüyor mu?
- [ ] Tarih doğru mu?
- [ ] Sezon Tekstil ilişkisi gösteriliyor mu?

### Sezon Tekstil
- [ ] Hesabı açın
- [ ] "İşlem Geçmişi" sekmesine gidin
- [ ] Aynı ₺114,000 transfer görünüyor mu?
- [ ] Tarih aynı mı?
- [ ] Co Denim ilişkisi gösteriliyor mu?

### Bakiye Kontrolü
- [ ] Her iki hesabın da bakiyesi doğru mu?
- [ ] Konsol hata mesajı yok mu?

---

## 🆘 Sorun mu Var?

### Transfer hala görünmüyor
```javascript
// Konsola yazın:
location.reload() // Hard refresh deneyin
```

### Console'da hata var
```javascript
// window.adminUtils tanımlı mı kontrol edin:
window.adminUtils.help()
```

### Bakiye yanlış
```javascript
// Bakiyeleri doğrulayın:
await window.adminUtils.verifyBalances()
```

---

## 📚 Daha Fazla Bilgi

- **Detaylı Rehber:** `DEBT-TRANSFER-RECOVERY-GUIDE.md`
- **Teknik Detaylar:** `DEBT-TRANSFER-COMPLETE-RECOVERY-SOLUTION.md`
- **Sorun Giderme:** `DEBT-TRANSFER-RECOVERY-GUIDE.md` → Troubleshooting

---

## ✅ Başarı Kriterleri

İşlem başarılıysa:
- ✅ ₺114,000 transfer her iki hesapta da görünür
- ✅ Tarihler eşleşiyor
- ✅ Bakiyeler doğru
- ✅ Konsol'da hata yok

**BAŞARDIN!** 🎉

---

**Toplam Süre:** ~60 saniye  
**Zorluk:** Çok Kolay ⭐  
**Geri Alınabilir:** Hayır (ama güvenli)  
**Risk:** Yok 🛡️

