(() => {
'use strict';
const copies={
  "fr": {
    "aria": "Préférences des cookies",
    "title": "Votre confidentialité sur RIMMA",
    "body": "Nous utilisons Google Analytics uniquement avec votre accord pour comprendre les visites, les pays et les sources de trafic. Ces données ne servent pas à la publicité personnalisée.",
    "more": "En savoir plus (espagnol)",
    "accept": "Accepter les statistiques",
    "reject": "Cookies nécessaires uniquement",
    "settings": "Cookies"
  },
  "de": {
    "aria": "Cookie-Einstellungen",
    "title": "Ihre Privatsphäre bei RIMMA",
    "body": "Wir verwenden Google Analytics nur mit Ihrer Zustimmung, um Besuche, Länder und Zugriffsquellen zu verstehen. Diese Daten werden nicht für personalisierte Werbung verwendet.",
    "more": "Mehr erfahren (Spanisch)",
    "accept": "Statistik akzeptieren",
    "reject": "Nur notwendige Cookies",
    "settings": "Cookies"
  },
  "it": {
    "aria": "Preferenze dei cookie",
    "title": "La tua privacy su RIMMA",
    "body": "Usiamo Google Analytics solo con il tuo consenso per comprendere visite, paesi e fonti di traffico. Questi dati non vengono usati per pubblicità personalizzata.",
    "more": "Scopri di più (spagnolo)",
    "accept": "Accetta le statistiche",
    "reject": "Solo cookie necessari",
    "settings": "Cookie"
  },
  "el": {
    "aria": "Προτιμήσεις cookies",
    "title": "Το απόρρητό σας στο RIMMA",
    "body": "Χρησιμοποιούμε το Google Analytics μόνο με τη συγκατάθεσή σας για να κατανοούμε επισκέψεις, χώρες και πηγές επισκεψιμότητας. Τα δεδομένα δεν χρησιμοποιούνται για εξατομικευμένη διαφήμιση.",
    "more": "Περισσότερα (ισπανικά)",
    "accept": "Αποδοχή στατιστικών",
    "reject": "Μόνο απαραίτητα cookies",
    "settings": "Cookies"
  },
  "sk": {
    "aria": "Nastavenia cookies",
    "title": "Vaše súkromie v RIMMA",
    "body": "Google Analytics používame len s vaším súhlasom na pochopenie návštev, krajín a zdrojov návštevnosti. Tieto údaje nepoužívame na personalizovanú reklamu.",
    "more": "Viac informácií (španielsky)",
    "accept": "Povoliť štatistiky",
    "reject": "Len nevyhnutné cookies",
    "settings": "Cookies"
  },
  "sr": {
    "aria": "Podešavanja kolačića",
    "title": "Vaša privatnost u RIMMA",
    "body": "Google Analytics koristimo samo uz vašu saglasnost radi razumevanja poseta, država i izvora saobraćaja. Ove podatke ne koristimo za personalizovano oglašavanje.",
    "more": "Više informacija (španski)",
    "accept": "Prihvati statistiku",
    "reject": "Samo neophodni kolačići",
    "settings": "Kolačići"
  },
  "tr": {
    "aria": "Çerez tercihleri",
    "title": "RIMMA’da gizliliğiniz",
    "body": "Ziyaretleri, ülkeleri ve trafik kaynaklarını anlamak için Google Analytics’i yalnızca onayınızla kullanırız. Bu veriler kişiselleştirilmiş reklamlar için kullanılmaz.",
    "more": "Daha fazla bilgi (İspanyolca)",
    "accept": "İstatistikleri kabul et",
    "reject": "Yalnızca gerekli çerezler",
    "settings": "Çerezler"
  }
};
window.RIMMA_COOKIE_COPY=copies[document.documentElement.lang.split('-')[0]];
for(const select of document.querySelectorAll('[data-country-selector]')){select.addEventListener('change',()=>{const allowed=['/','/br/',"/fr/","/de/","/it/","/gr/","/sk/","/rs/","/tr/"];if(allowed.includes(select.value))location.assign(select.value);});}
})();
