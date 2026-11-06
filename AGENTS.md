# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# APK release kurali

Kullanici icin APK gerektiginde SADECE `assembleRelease` (release build) uretilir,
`assembleDebug` kullanilmaz. Debug build yalnizca gelistirme sirasinda native
tarafin derlendigini dogrulamak gibi ic amaclar icin, gecici olarak calistirilabilir;
kullaniciya verilecek/kurulacak APK her zaman release olmali.

Her `assembleRelease` calistirildiginda dosya adina otomatik tarih+saat eklenir
(`app-release-MM-dd_HH-mm.apk`, bkz. `android/app/build.gradle`). Bunun nedeni:
WhatsApp/transfer araclari ayni dosya adini (`app-release.apk`) onbellekte tutup
eski surumu gonderebiliyor; her build'in adi farkli olunca bu karisiklik olmuyor.
Yol, Windows'un 260 karakter sinirina takilirsa proje kisa bir yola (orn. `C:\rnapp`)
kopyalanip oradan derlenmeli (orijinal proje klasoru degistirilmeden).
