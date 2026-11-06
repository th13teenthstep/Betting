const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// betting.db'yi (onceden hazirlanmis SQLite seed dosyasi) bundled asset
// olarak paketlemek icin Metro'nun asset uzanti listesine ekliyoruz.
config.resolver.assetExts.push('db');

module.exports = config;