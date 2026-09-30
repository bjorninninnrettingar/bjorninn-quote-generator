// Kitchen planner → Line Items mapping (V1 = cabinet body, V2 = what makes it specific).
// GENERATED 2026-09-30 from Airtable "Útfærslur 🎨" (tbl8HjvBwNJ41cTV0, base app91U15z9K704Okd) by
// Vörunúmer (SKU), not by name — re-generate rather than hand-edit if products change. Pairings follow
// what real Line Items use (2639 rows checked): drawer cabinets = OPEN body (GR/HA/LK, no door) +
// drawer combo; shelved cabinets = CLOSED body (LGR/LHA/LEF…) + "N hillur"; oven/fridge/washer/pantry
// = closed tall (LHA) + its own Útfærsla; bin = GR + RUSL60/80; dishwasher = its front (UÞVFR) alone.
// Drawer combo keys: codes in the order N M K E C F (one letter per drawer), then "+IK"/"+IM" for an
// inner drawer — e.g. Merivo E+K+M = "MKE". Every combo of up to 4 drawers exists for both systems.
window.KP_LINEMAP = {
 "v1": {
  "grunnskapur": {
   "closed": {
    "300": {
     "id": "recavcUhCIylAX1NC",
     "name": "Lokaður grunnskápur 30sm",
     "sku": "LGR30"
    },
    "400": {
     "id": "recyqubggHAaQEl6k",
     "name": "Lokaður grunnskápur 40sm",
     "sku": "LGR40"
    },
    "500": {
     "id": "recZcXiFomYNQgT3M",
     "name": "Lokaður grunnskápur 50sm",
     "sku": "LGR50"
    },
    "600": {
     "id": "recBmLITNeGC8dqxo",
     "name": "Lokaður grunnskápur 60sm",
     "sku": "LGR60"
    },
    "700": {
     "id": "recAx92PDOGmVgRbx",
     "name": "Lokaður grunnskápur 70sm",
     "sku": "LGR70"
    },
    "800": {
     "id": "rec2AG0Nxebhda6Ji",
     "name": "Lokaður grunnskápur 80sm",
     "sku": "LGR80"
    },
    "900": {
     "id": "recgHwqa5EJftF6fV",
     "name": "Lokaður grunnskápur 90sm",
     "sku": "LGR90"
    },
    "1000": {
     "id": "recokTf5KS2W7QvhQ",
     "name": "Lokaður grunnskápur 100sm",
     "sku": "LGR100"
    },
    "1100": {
     "id": "recdmDyx3tOq1a14f",
     "name": "Lokaður grunnskápur 110sm",
     "sku": "LGR110"
    },
    "1200": {
     "id": "recMDRCvd1opLovjN",
     "name": "Lokaður grunnskápur 120sm",
     "sku": "LGR120"
    }
   },
   "open": {
    "300": {
     "id": "rechXwcGCTK5PBkiS",
     "name": "Grunnskápur 30sm",
     "sku": "GR30"
    },
    "400": {
     "id": "rec0s9zUXSZZAfrxR",
     "name": "Grunnskápur 40sm",
     "sku": "GR40"
    },
    "500": {
     "id": "recf3EySixYrCnTNk",
     "name": "Grunnskápur 50sm",
     "sku": "GR50"
    },
    "600": {
     "id": "recunQBKJM9n3Va61",
     "name": "Grunnskápur 60sm",
     "sku": "GR60"
    },
    "700": {
     "id": "rec8GcvVo2BkIRZIf",
     "name": "Grunnskápur 70sm",
     "sku": "GR70"
    },
    "800": {
     "id": "recuVj398tI7R6UL2",
     "name": "Grunnskápur 80sm",
     "sku": "GR80"
    },
    "900": {
     "id": "recrIqPe4JCl9tRTD",
     "name": "Grunnskápur 90sm",
     "sku": "GR90"
    },
    "1000": {
     "id": "recxysoqm2WFrCXeg",
     "name": "Grunnskápur 100sm",
     "sku": "GR100"
    },
    "1100": {
     "id": "recfo2VfuY0RL0AGU",
     "name": "Grunnskápur 110sm",
     "sku": "GR110"
    },
    "1200": {
     "id": "recGqOzPVnRkoZB5K",
     "name": "Grunnskápur 120sm",
     "sku": "GR120"
    }
   }
  },
  "harskapur": {
   "closed": {
    "300": {
     "id": "recfHYiAnRJSFDY42",
     "name": "Lokaður hár skápur 30sm",
     "sku": "LHA30"
    },
    "400": {
     "id": "recHExXHBQ1bKa15M",
     "name": "Lokaður hár skápur 40sm",
     "sku": "LHA40"
    },
    "500": {
     "id": "recROVna0zIOVndog",
     "name": "Lokaður hár skápur 50sm",
     "sku": "LHA50"
    },
    "600": {
     "id": "recmSaJVgCvwnRNUe",
     "name": "Lokaður hár skápur 60sm",
     "sku": "LHA60"
    },
    "700": {
     "id": "recmu7p7PEayjWi1n",
     "name": "Lokaður hár skápur 70sm",
     "sku": "LHA70"
    },
    "800": {
     "id": "recI67pf7xA5hj4j3",
     "name": "Lokaður hár skápur 80sm",
     "sku": "LHA80"
    },
    "900": {
     "id": "recQzSO0e4NJUjIg3",
     "name": "Lokaður hár skápur 90sm",
     "sku": "LHA90"
    },
    "1000": {
     "id": "recg6IMjNL324ecrh",
     "name": "Lokaður hár skápur 100sm",
     "sku": "LHA100"
    },
    "1100": {
     "id": "recA3IGkaDqJ334Qq",
     "name": "Lokaður hár skápur 110sm",
     "sku": "LHA110"
    },
    "1200": {
     "id": "rec06KsWmOv1HIgz5",
     "name": "Lokaður hár skápur 120sm",
     "sku": "LHA120"
    }
   },
   "open": {
    "300": {
     "id": "rec0mjh6gMm02XvvZ",
     "name": "Hár skápur 30sm",
     "sku": "HA30"
    },
    "400": {
     "id": "rec3Rkl6w7l1A58Nw",
     "name": "Hár skápur 40sm",
     "sku": "HA40"
    },
    "500": {
     "id": "recBUTL2TIbfdMFOe",
     "name": "Hár skápur 50sm",
     "sku": "HA50"
    },
    "600": {
     "id": "recb5BSFSlsEPSALU",
     "name": "Hár skápur 60sm",
     "sku": "HA60"
    },
    "700": {
     "id": "recYemSDW6rlQKQ4G",
     "name": "Hár skápur 70sm",
     "sku": "HA70"
    },
    "800": {
     "id": "rectVHIfSpgt3se8k",
     "name": "Hár skápur 80sm",
     "sku": "HA80"
    },
    "900": {
     "id": "recrI4iiua1AUQU0g",
     "name": "Hár skápur 90sm",
     "sku": "HA90"
    },
    "1000": {
     "id": "recEDE1JKFGOPQkLU",
     "name": "Hár skápur 100sm",
     "sku": "HA100"
    },
    "1100": {
     "id": "recpmObJ9uMQggcMf",
     "name": "Hár skápur 110sm",
     "sku": "HA110"
    },
    "1200": {
     "id": "recNyvdDk0ExHlJRo",
     "name": "Hár skápur 120sm",
     "sku": "HA120"
    }
   }
  },
  "efriskapur": {
   "closed": {
    "300": {
     "id": "recFdk8bLJrphAhUo",
     "name": "Lokaður efri skápur 30sm",
     "sku": "LEF30"
    },
    "400": {
     "id": "recfLYXvmD6bQsum8",
     "name": "Lokaður efri skápur 40sm",
     "sku": "LEF40"
    },
    "500": {
     "id": "recVmsIEwMmzOJmOt",
     "name": "Lokaður efri skápur 50sm",
     "sku": "LEF50"
    },
    "600": {
     "id": "recLRou29hMgmiWTR",
     "name": "Lokaður efri skápur 60sm",
     "sku": "LEF60"
    },
    "700": {
     "id": "recd05Aw4v6DZMmZd",
     "name": "Lokaður efri skápur 70sm",
     "sku": "LEF70"
    },
    "800": {
     "id": "rec0Kvz8ZHUYGIh5N",
     "name": "Lokaður efri skápur 80sm",
     "sku": "LEF80"
    },
    "900": {
     "id": "recsgOfn2RPfsf3OE",
     "name": "Lokaður efri skápur 90sm",
     "sku": "LEF90"
    },
    "1000": {
     "id": "recPzvDulVh1pDhTF",
     "name": "Lokaður efri skápur 100sm",
     "sku": "LEF100"
    },
    "1100": {
     "id": "recwVmffGXQPG7tGx",
     "name": "Lokaður efri skápur 110sm",
     "sku": "LEF110"
    },
    "1200": {
     "id": "recm1iJsiNOup6Irq",
     "name": "Lokaður efri skápur 120sm",
     "sku": "LEF120"
    }
   },
   "open": {
    "300": {
     "id": "recTzNeyv2OJhsw0F",
     "name": "Efri skápur 30sm",
     "sku": "EF30"
    },
    "400": {
     "id": "recqnw5R4gXI1llOi",
     "name": "Efri skápur 40sm",
     "sku": "EF40"
    },
    "500": {
     "id": "recFQMIixR6WxxehF",
     "name": "Efri skápur 50sm",
     "sku": "EF50"
    },
    "600": {
     "id": "recIlVZWpc2qooD5S",
     "name": "Efri skápur 60sm",
     "sku": "EF60"
    },
    "700": {
     "id": "recR57qv3FZzApWT8",
     "name": "Efri skápur 70sm",
     "sku": "EF70"
    },
    "800": {
     "id": "recSNy3jrCPmePlE9",
     "name": "Efri skápur 80sm",
     "sku": "EF80"
    },
    "900": {
     "id": "rectBoC7jdFgLTphm",
     "name": "Efri skápur 90sm",
     "sku": "EF90"
    },
    "1000": {
     "id": "recS3auWDfxQ1xxiQ",
     "name": "Efri skápur 100sm",
     "sku": "EF100"
    },
    "1100": {
     "id": "recXmWvKcnFg6jFF6",
     "name": "Efri skápur 110sm",
     "sku": "EF110"
    },
    "1200": {
     "id": "reconAiPV5oCTYkiT",
     "name": "Efri skápur 120sm",
     "sku": "EF120"
    }
   }
  },
  "litillkassi": {
   "closed": {
    "300": {
     "id": "rec3ivJbIyt31PRjE",
     "name": "Lokaður lítill kassi 30sm",
     "sku": "LLK30"
    },
    "400": {
     "id": "recden4UTTNyZGjir",
     "name": "Lokaður lítill kassi 40sm",
     "sku": "LLK40"
    },
    "500": {
     "id": "recaYgd2RcqRNAPH8",
     "name": "Lokaður lítill kassi 50sm",
     "sku": "LLK50"
    },
    "600": {
     "id": "recWK1ow0dMsGD03I",
     "name": "Lokaður lítill kassi 60sm",
     "sku": "LLK60"
    },
    "700": {
     "id": "recWy6cr0rjz2s5wN",
     "name": "Lokaður lítill kassi 70sm",
     "sku": "LLK70"
    },
    "800": {
     "id": "reckFswFQLT3xgZuY",
     "name": "Lokaður lítill kassi 80sm",
     "sku": "LLK80"
    },
    "900": {
     "id": "recvhRPPSVZz7vqtI",
     "name": "Lokaður lítill kassi 90sm",
     "sku": "LLK90"
    },
    "1000": {
     "id": "recSUFp8X2pJ1As4l",
     "name": "Lokaður lítill kassi 100sm",
     "sku": "LLK100"
    },
    "1100": {
     "id": "recxQDNEAfNAE8cdN",
     "name": "Lokaður lítill kassi 110sm",
     "sku": "LLK110"
    },
    "1200": {
     "id": "recaSsXt5zyXTRkap",
     "name": "Lokaður lítill kassi 120sm",
     "sku": "LLK120"
    }
   },
   "open": {
    "300": {
     "id": "recpsm8uLMpw6drk1",
     "name": "Lítill kassi 30sm",
     "sku": "LK30"
    },
    "400": {
     "id": "recfj1MhCOJBxYoCO",
     "name": "Lítill kassi 40sm",
     "sku": "LK40"
    },
    "500": {
     "id": "rechzYilE6JvzyCWy",
     "name": "Lítill kassi 50sm",
     "sku": "LK50"
    },
    "600": {
     "id": "recdnMNUozTGqsOIj",
     "name": "Lítill kassi 60sm",
     "sku": "LK60"
    },
    "700": {
     "id": "rec1ufzUxV5XhWJr6",
     "name": "Lítill kassi 70sm",
     "sku": "LK70"
    },
    "800": {
     "id": "recf82EPfM5qI3gTq",
     "name": "Lítill kassi 80sm",
     "sku": "LK80"
    },
    "900": {
     "id": "recd0YIgmPCEY8oKY",
     "name": "Lítill kassi 90sm",
     "sku": "LK90"
    },
    "1000": {
     "id": "recVEXiUTMKGgeCGW",
     "name": "Lítill kassi 100sm",
     "sku": "LK100"
    },
    "1100": {
     "id": "recEgELxJhv3DKnTp",
     "name": "Lítill kassi 110sm",
     "sku": "LK110"
    },
    "1200": {
     "id": "rechcybpmVuCthyO4",
     "name": "Lítill kassi 120sm",
     "sku": "LK120"
    }
   }
  },
  "harveggskapur": {
   "closed": {
    "300": {
     "id": "recWTAv6iK2IiLsF1",
     "name": "Lokaður hár veggskápur 30sm",
     "sku": "LVS30"
    },
    "400": {
     "id": "recOFjaDCjjyZsft5",
     "name": "Lokaður hár veggskápur 40sm",
     "sku": "LVS40"
    },
    "500": {
     "id": "recVdSvu2MvlHUb2o",
     "name": "Lokaður hár veggskápur 50sm",
     "sku": "LVS50"
    },
    "600": {
     "id": "recCt3myhqJkVUZt8",
     "name": "Lokaður hár veggskápur 60sm",
     "sku": "LVS60"
    },
    "700": {
     "id": "recC6e5DTC1ES9iJf",
     "name": "Lokaður hár veggskápur 70sm",
     "sku": "LVS70"
    },
    "800": {
     "id": "recQJEMXvQKGA4WWt",
     "name": "Lokaður hár veggskápur 80sm",
     "sku": "LVS80"
    },
    "900": {
     "id": "recqqLDRRMySqzMEr",
     "name": "Lokaður hár veggskápur 90sm",
     "sku": "LVS90"
    },
    "1000": {
     "id": "recMsMXauWvCA43Vm",
     "name": "Lokaður hár veggskápur 100sm",
     "sku": "LVS100"
    },
    "1100": {
     "id": "recPYxSgTTwCER1UP",
     "name": "Lokaður hár veggskápur 110sm",
     "sku": "LVS110"
    },
    "1200": {
     "id": "recsI5OJakjIdFjoe",
     "name": "Lokaður hár veggskápur 120sm",
     "sku": "LVS120"
    }
   },
   "open": {
    "300": {
     "id": "recGGtaUCNiqBT8hp",
     "name": "Hár veggskápur 30sm",
     "sku": "VS30"
    },
    "400": {
     "id": "rechp4TrQAdpVDDwM",
     "name": "Hár veggskápur 40sm",
     "sku": "VS40"
    },
    "500": {
     "id": "recI3X1Kxk5gYGVS8",
     "name": "Hár veggskápur 50sm",
     "sku": "VS50"
    },
    "600": {
     "id": "recki4yNurCLmr0wo",
     "name": "Hár veggskápur 60sm",
     "sku": "VS60"
    },
    "700": {
     "id": "receuAhHoFRahxlhD",
     "name": "Hár veggskápur 70sm",
     "sku": "VS70"
    },
    "800": {
     "id": "recLmQVcNQLwiVXpk",
     "name": "Hár veggskápur 80sm",
     "sku": "VS80"
    },
    "900": {
     "id": "rec7JtkJdBiuWzJP0",
     "name": "Hár veggskápur 90sm",
     "sku": "VS90"
    },
    "1000": {
     "id": "recWzhcNZAYvVvgQO",
     "name": "Hár veggskápur 100sm",
     "sku": "VS100"
    },
    "1100": {
     "id": "recSvGrcn1sKk2tZT",
     "name": "Hár veggskápur 110sm",
     "sku": "VS110"
    },
    "1200": {
     "id": "rectlCdS2qEwDDh2G",
     "name": "Hár veggskápur 120sm",
     "sku": "VS120"
    }
   }
  }
 },
 "v2Drawers": {
  "legra": {
   "MMMF": {
    "id": "rec1yvzFHkjcn80Yh",
    "name": "Legra - 1 F-skúffa | 3 M-skúffur",
    "sku": "L-FM3"
   },
   "MMKC": {
    "id": "rec3giTXtSRO3CVoX",
    "name": "Legra - 1 C-skúffa | 1 K-skúffa | 2 M-skúffur",
    "sku": "L-CKMM"
   },
   "CC": {
    "id": "rec7b2olyB56nG29s",
    "name": "Legra - 2 C-skúffur",
    "sku": "L-CC"
   },
   "F+IK": {
    "id": "rec8D3OoMW1VKbrXE",
    "name": "Legra - 1 F-skúffa | 1 inn K-skúffa",
    "sku": "L-FIK"
   },
   "KKFF": {
    "id": "rec8FAFOWomMJzevD",
    "name": "Legra - 2 F-skúffur | 2 K-skúffur",
    "sku": "L-FFKK"
   },
   "MCFF": {
    "id": "rec8gEb2ZGMrRcHsl",
    "name": "Legra - 2 F-skúffur | 1 C-skúffa | 1 M-skúffa",
    "sku": "L-FFCM"
   },
   "CC+IK": {
    "id": "rec9a5Xg3HckUJCSL",
    "name": "Legra - 2 C-skúffur | 1 inn K-skúffa",
    "sku": "L-CCIK"
   },
   "MKFF": {
    "id": "rec9yUJyICQyXP8y3",
    "name": "Legra - 2 F-skúffur | 1 K- skúffa | 1 M-skúffa",
    "sku": "L-FFKM"
   },
   "KC+IM": {
    "id": "recBR7Hp7HIjQUwHk",
    "name": "Legra - 1 C-skúffa | 1 K-skúffa | 1 inn M-skúffa",
    "sku": "L-CKIM"
   },
   "MFF": {
    "id": "recCjGhGho3QmwULX",
    "name": "Legra - 2 F-skúffur | 1 M-skúffa",
    "sku": "L-FFM"
   },
   "KCCF": {
    "id": "recDjfth2wsupSpZu",
    "name": "Legra - 1 F-skúffa | 2 C-skúffur | 1 K-skúffa",
    "sku": "L-FCCK"
   },
   "MKCF": {
    "id": "recENdRyMD1XYavWh",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 1 K-skúffa | 1 M-skúffa",
    "sku": "L-FCKM"
   },
   "FF": {
    "id": "recEjA27bYpKAvxWR",
    "name": "Legra - 2 F-skúffur",
    "sku": "L-FF"
   },
   "MKCC": {
    "id": "recFHcrIftfJeQRCd",
    "name": "Legra - 2 C-skúffur | 1 K-skúffa, 1 M-skúffa",
    "sku": "L-CCKM"
   },
   "MCCC": {
    "id": "recFP9sjxsQSzNxWe",
    "name": "Legra - 3 C-skúffur | 1 M-skúffa",
    "sku": "L-C3M"
   },
   "MCC": {
    "id": "recGBI5ril51oIxEF",
    "name": "Legra - 2 C-skúffur | 1 M-skúffa",
    "sku": "L-CCM"
   },
   "CCC": {
    "id": "recGBUZb3lrrCPJt1",
    "name": "Legra - 3 C-skúffur",
    "sku": "L-C3"
   },
   "CFF": {
    "id": "recIVzkgDXLFJ6W4T",
    "name": "Legra - 2 F-skúffur | 1 C-skúffa",
    "sku": "L-FFC"
   },
   "K": {
    "id": "recIjnUoLGno1iXTS",
    "name": "Legra K-skúffa",
    "sku": "L-K"
   },
   "KFF": {
    "id": "recJJN9t0KBtZq7pM",
    "name": "Legra - 2 F-skúffur | 1 K-skúffa",
    "sku": "L-FFK"
   },
   "MM": {
    "id": "recJLhDIw2l3x2uw4",
    "name": "Legra - 2 M-skúffur",
    "sku": "L-MM"
   },
   "MF": {
    "id": "recJmHfZwa9fRrR3B",
    "name": "Legra - 1 F-skúffa | 1 M-skúffa",
    "sku": "L-FM"
   },
   "MMMK": {
    "id": "recKOnwUAg5YAC3GJ",
    "name": "Legra - 1 K-skúffa | 3 M-skúffur",
    "sku": "L-KM3"
   },
   "CCFF": {
    "id": "recKlq15WgBXai0GZ",
    "name": "Legra - 2 F-skúffur | 2 C-skúffur",
    "sku": "L-FFCC"
   },
   "KCFF": {
    "id": "recKmeMtyeQEOnRHV",
    "name": "Legra - 2 F-skúffur | 1 C-skúffa, 1 K-skúffa",
    "sku": "L-FFCK"
   },
   "MKKF": {
    "id": "recNj4TICAXl6Bugz",
    "name": "Legra - 1 F-skúffa | 2 K-skúffur | 1 M-skúffa",
    "sku": "L-FKKM"
   },
   "MCCF": {
    "id": "recQMYFIVfi0CplIO",
    "name": "Legra - 1 F-skúffa | 2 C-skúffur | 1 M-skúffa",
    "sku": "L-FCCM"
   },
   "MKKK": {
    "id": "recS9UdABfv8LQNq2",
    "name": "Legra - 3 K-skúffur | 1 M-skúffa",
    "sku": "L-K3M"
   },
   "F+IM": {
    "id": "recSoONi0oQ7MCQVj",
    "name": "Legra - 1 F-skúffa | 1 inn M-skúffa",
    "sku": "L-FIM"
   },
   "CFFF": {
    "id": "recUUWXFIeDG3ki9d",
    "name": "Legra - 3 F-skúffur | 1 C-skúffa",
    "sku": "L-F3C"
   },
   "MCF": {
    "id": "recVPE6UlBNeG9v93",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 1 M-skúffa",
    "sku": "L-FCM"
   },
   "KCF": {
    "id": "recWPKRibZb4GVzje",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 1 K-skúffa",
    "sku": "L-FCK"
   },
   "MMF": {
    "id": "recXFz7YKySKJlNdM",
    "name": "Legra - 1 F-skúffa | 2 M-skúffur",
    "sku": "L-FMM"
   },
   "MKKC": {
    "id": "recXVIhOok3z16ftD",
    "name": "Legra - 1 C-skúffa | 2 K-skúffur | 1 M-skúffa",
    "sku": "L-CKKM"
   },
   "F": {
    "id": "recY6Jot80vUv9zKa",
    "name": "Legra F-skúffa",
    "sku": "L-F"
   },
   "M": {
    "id": "recY9n7DxcQCQa6jD",
    "name": "Legra M-skúffa",
    "sku": "L-M"
   },
   "KKC": {
    "id": "recYr5tcHXLNMeE6j",
    "name": "Legra - 1 C-skúffa | 2 K-skúffur",
    "sku": "L-CKK"
   },
   "MMMM": {
    "id": "recZ77TH8zqb2Lch4",
    "name": "Legra - 4 M-skúffur",
    "sku": "L-M4"
   },
   "MKC": {
    "id": "recZbXcCtYYwxf5wA",
    "name": "Legra - 1 C-skúffa | 1 K-skúffa | 1 M -skúffa",
    "sku": "L-CKM"
   },
   "MMCF": {
    "id": "recZsI3VdTARLFkdw",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 2 M-skúffur",
    "sku": "L-FCMM"
   },
   "FFFF": {
    "id": "recamOD09QL84m5MQ",
    "name": "Legra - 4 F-skúffur",
    "sku": "L-F4"
   },
   "MMCC": {
    "id": "recbOpKjKkouH9v6M",
    "name": "Legra - 2 C-skúffur | 2 M-skúffur",
    "sku": "L-CCMM"
   },
   "KKK": {
    "id": "recbtrm7fTL3gv87G",
    "name": "Legra - 3 K-skúffur",
    "sku": "L-K3"
   },
   "MMKK": {
    "id": "reccG8MRAJLfGUgvc",
    "name": "Legra - 2 K-skúffur | 2 M-skúffur",
    "sku": "L-KKMM"
   },
   "KKKF": {
    "id": "recckl7zV8RVDrsjR",
    "name": "Legra - 1 F-skúffa | 3 K-skúffur",
    "sku": "L-FK3"
   },
   "KKCC": {
    "id": "recd7Pg12ZjGN2ggP",
    "name": "Legra - 2 C-skúffur | 2 K-skúffur",
    "sku": "L-CCKK"
   },
   "KFFF": {
    "id": "recexZlEzhC1JieSf",
    "name": "Legra - 3 F-skúffur | 1 K-skúffa",
    "sku": "L-F3K"
   },
   "MMKF": {
    "id": "recexkSptk0G6LmT7",
    "name": "Legra - 1 F-skúffa | 1 K-skúffa | 2 M-skúffa",
    "sku": "L-FKMM"
   },
   "KC": {
    "id": "recgsLJKRtLRe7iFp",
    "name": "Legra - 1 C-skúffa | 1 K-skúffa",
    "sku": "L-CK"
   },
   "CF+IM": {
    "id": "recj2tw6RMdxq2jp7",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 1 inn M-skúffa",
    "sku": "L-FCIM"
   },
   "C": {
    "id": "reckZSxIVGYnBA8h7",
    "name": "Legra C-skúffa",
    "sku": "L-C"
   },
   "MFFF": {
    "id": "reclPSBp3U3tDRRv6",
    "name": "Legra - 3 F-skúffur | 1 M-skúffa",
    "sku": "L-F3M"
   },
   "MMM": {
    "id": "recm2OTEBzDMIi8sq",
    "name": "Legra - 3 M-skúffur",
    "sku": "L-M3"
   },
   "MC": {
    "id": "recmEFoi67Hy42uzs",
    "name": "Legra - 1 C-skúffa | 1 M-skúffa",
    "sku": "L-CM"
   },
   "CCF": {
    "id": "recnCj631UxIU34RT",
    "name": "Legra - 1 F-skúffur | 2 C-skúffur",
    "sku": "L-FCC"
   },
   "KKKC": {
    "id": "recnj4c8aqWpMTtJK",
    "name": "Legra - 1 C-skúffa | 3 K-skúffur",
    "sku": "L-CK3"
   },
   "CCCF": {
    "id": "recoMqBU14uvuxvBz",
    "name": "Legra - 1 F-skúffa | 3 C-skúffur",
    "sku": "L-FC3"
   },
   "KCCC": {
    "id": "recp1EnQPlSxfH2ov",
    "name": "Legra - 3 C-skúffur | 1 K-skúffa",
    "sku": "L-C3K"
   },
   "KCC": {
    "id": "recptPvbdisZdza4Y",
    "name": "Legra - 2 C-skúffur | 1 K-skúffa",
    "sku": "L-CCK"
   },
   "KF": {
    "id": "recqFG22yAKS56hAT",
    "name": "Legra - 1 F-skúffa  | 1 K-skúffa",
    "sku": "L-FK"
   },
   "MMFF": {
    "id": "recqKMxi1EAnA3UPd",
    "name": "Legra - 2 F-skúffur | 2 M-skúffur",
    "sku": "L-FFMM"
   },
   "MKK": {
    "id": "recqSErsiI4uyXm7F",
    "name": "Legra - 2 K-skúffur | 1 M-skúffa",
    "sku": "L-KKM"
   },
   "CF": {
    "id": "recqsZkBcNBdnLdb4",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa",
    "sku": "L-FC"
   },
   "MK": {
    "id": "recsOayucwjUIg8IA",
    "name": "Legra - 1 K-skúffa | 1 M-skúffa",
    "sku": "L-KM"
   },
   "MMMC": {
    "id": "rect48tWhy7rutO2m",
    "name": "Legra - 1 C-skúffa | 3 M-skúffur",
    "sku": "L-CM3"
   },
   "KKF": {
    "id": "rect8fNCpZdCb4pSY",
    "name": "Legra - 1 F-skúffa | 2 K-skúffur",
    "sku": "L-FKK"
   },
   "MMC": {
    "id": "rectjLUiRtUm2OwDA",
    "name": "Legra - 1 C-skúffa | 2 M-skúffur",
    "sku": "L-CMM"
   },
   "KKKK": {
    "id": "recttZsr4BcUKlHmv",
    "name": "Legra - 4 K-skúffur",
    "sku": "L-K4"
   },
   "MKF": {
    "id": "recubTiIJ6BCFdfoO",
    "name": "Legra - 1 F-skúffa | 1 K-skúffa | 1 M-skúffa",
    "sku": "L-FKM"
   },
   "CCCC": {
    "id": "recvTEH6OXhgIQmOy",
    "name": "Legra - 4 C-skúffur",
    "sku": "L-C4"
   },
   "MMK": {
    "id": "recxu3SmVWzZgnek1",
    "name": "Legra - 1 K-skúffur | 2 M-skúffa",
    "sku": "L-KMM"
   },
   "FFF": {
    "id": "recxvtCugOjHpiKUH",
    "name": "Legra - 3 F-skúffur",
    "sku": "L-F3"
   },
   "KKCF": {
    "id": "recyquT3XfAYnsE8F",
    "name": "Legra - 1 F-skúffa | 1 C-skúffa | 2 K-skúffur",
    "sku": "L-FCKK"
   },
   "KK": {
    "id": "recz4VESgHWqDFNpH",
    "name": "Legra - 2 K-skúffur",
    "sku": "L-KK"
   }
  },
  "merivo": {
   "MMK": {
    "id": "rec10unIVmn3M9ept",
    "name": "Merivo - 1 K-skúffur | 2 M-skúffa",
    "sku": "M-KMM"
   },
   "EE+IM": {
    "id": "rec5DErYRQ5g631EE",
    "name": "Merivo - 2 E-skúffur | 1 inn M-skúffa",
    "sku": "M-EEIM"
   },
   "MKKE": {
    "id": "rec8NpgZns3fWplQU",
    "name": "Merivo - 1 E-skúffa | 2 K-skúffur | 1 M-skúffa",
    "sku": "M-EKKM"
   },
   "KKEE": {
    "id": "rec8okmxyp7fq33DH",
    "name": "Merivo - 2 E-skúffur | 2 K-skúffur",
    "sku": "M-EEKK"
   },
   "KKE": {
    "id": "rec95zYrzkqdPo08D",
    "name": "Merivo - 1 E-skúffur | 2 K-skúffa",
    "sku": "M-EKK"
   },
   "K": {
    "id": "recAz3anWWDgrmCbQ",
    "name": "Merivo K-skúff",
    "sku": "M-K"
   },
   "E": {
    "id": "recCX41s6WKEFcgdp",
    "name": "Merivo E-skúff",
    "sku": "M-E"
   },
   "MMM": {
    "id": "recCb4L0Cb07SUwFV",
    "name": "Merivo - 3 M-skúffur",
    "sku": "M-M3"
   },
   "MMME": {
    "id": "recDUonfqU76jJgxK",
    "name": "Merivo - 1 E-skúffa | 3 M-skúffur",
    "sku": "M-EM3"
   },
   "EEE": {
    "id": "recFIP4tYUWBYOQ6u",
    "name": "Merivo - 3 E-skúffur",
    "sku": "M-E3"
   },
   "MKK": {
    "id": "recHxwxPsZ8UKkx2T",
    "name": "Merivo - 2 K-skúffur | 1 M-skúffa",
    "sku": "M-KKM"
   },
   "E+IM": {
    "id": "recJ272T0IDOTuAnT",
    "name": "Merivo - 1 E-skúffa | 1 inn M-skúffa",
    "sku": "M-EIM"
   },
   "MEEE": {
    "id": "recLMdnh5VCEoqzNj",
    "name": "Merivo - 3 E-skúffur | 1 M-súffa",
    "sku": "M-E3M"
   },
   "EE": {
    "id": "recLqpiTMxZt5bihr",
    "name": "Merivo - 2 E-skúffur",
    "sku": "M-EE"
   },
   "N": {
    "id": "recOYFlsemmPuxvOF",
    "name": "Merivo N-skúff",
    "sku": "M-N"
   },
   "M": {
    "id": "recPKT34Lvr2dAla3",
    "name": "Merivo M-skúff",
    "sku": "M-M"
   },
   "MKKK": {
    "id": "recQMAF9SEyF6QVSC",
    "name": "Merivo - 3 K-skúffur | 1 M-skúffa",
    "sku": "M-K3M"
   },
   "MM": {
    "id": "recSHDRhBoOabGSlu",
    "name": "Merivo - 2 M-skúffur",
    "sku": "M-MM"
   },
   "MMMK": {
    "id": "recSHgpNpky1xFNG3",
    "name": "Merivo - 1 K-skúffa | 3 M-skúffur",
    "sku": "M-KM3"
   },
   "KKKK": {
    "id": "recSkiQd0qvloCJPG",
    "name": "Merivo - 4 K-skúffur",
    "sku": "M-K4"
   },
   "MMKE": {
    "id": "recTEBd5iNpmNAXDM",
    "name": "Merivo - 1 E-skúffa | 1 K-skúffa | 2 M-skúffur",
    "sku": "M-EKMM"
   },
   "KK+IM": {
    "id": "recTh8wE1JA0qoQ1a",
    "name": "Merivo - 2 K-skúffur | 1 inn M-skúffa",
    "sku": "M-KKIM"
   },
   "MK": {
    "id": "recUSj1EoQpUixlgH",
    "name": "Merivo - 1 K-skúffa | 1 M-skúffa",
    "sku": "M-KM"
   },
   "ME": {
    "id": "recV2pnB9Kt9B8f2c",
    "name": "Merivo - 1 E-skúffa | 1 M-skúffa",
    "sku": "M-EM"
   },
   "MME": {
    "id": "recVgypc4ScMGJj3u",
    "name": "Merivo - 1 E-skúffa | 2 M-skúffur",
    "sku": "M-EMM"
   },
   "MMMM": {
    "id": "recYHHprqxFcUeKgd",
    "name": "Merivo - 4 M-skúffur",
    "sku": "M-M4"
   },
   "MMKK": {
    "id": "rechWd9bFvHJFV39k",
    "name": "Merivo - 2 K-skúffur | 2 M-skúffur",
    "sku": "M-KKMM"
   },
   "KEE": {
    "id": "rechXscKrQpci777z",
    "name": "Merivo - 2 E-skúffur | 1 K-Skúffa",
    "sku": "M-EEK"
   },
   "KEEE": {
    "id": "rechu1PwgfBOXPaAw",
    "name": "Merivo - 3 E-skúffur | 1 K-skúffa",
    "sku": "M-E3K"
   },
   "MEE": {
    "id": "recjM8mJh34OgfMAN",
    "name": "Merivo - 2 E-skúffur | 1 M-skúffa",
    "sku": "M-EEM"
   },
   "MKEE": {
    "id": "recjjqw0HjfKoDwsv",
    "name": "Merivo - 2 E-skúffur | 1 K-Skúffa, 1 M-skúffa",
    "sku": "M-EEKM"
   },
   "MKE": {
    "id": "reclQDfn1f6Y63LnB",
    "name": "Merivo - 1 E-skúff | 1 K-skúff | 1 M - skúff",
    "sku": "M-EKM"
   },
   "KKK": {
    "id": "recqLc95szXXwwyOr",
    "name": "Merivo - 3 K-skúffur",
    "sku": "M-K3"
   },
   "MMEE": {
    "id": "recrGCIVetW5VTkao",
    "name": "Merivo - 2 E-skúffur | 2 M-skúffur",
    "sku": "M-EEMM"
   },
   "KE": {
    "id": "recs98P5BZBtsyEEe",
    "name": "Merivo - 1 E-skúffa | 1 K-skúffa",
    "sku": "M-EK"
   },
   "KK": {
    "id": "rectvjDtLdwUvGthr",
    "name": "Merivo - 2 K-skúffur",
    "sku": "M-KK"
   },
   "EEEE": {
    "id": "recuQcpwJDRxvZXyv",
    "name": "Merivo - 4 E-skúffur",
    "sku": "M-E4"
   },
   "KE+IM": {
    "id": "recwa1x4COxjK7pTz",
    "name": "Merivo - 1 E-skúffa | 1 K-skúffa | 1 inn M-skúffa",
    "sku": "M-EKIM"
   },
   "KKKE": {
    "id": "reczuCkN3arEhYphz",
    "name": "Merivo - 1 E-skúffa | 3 K-skúffur",
    "sku": "M-EK3"
   }
  }
 },
 "v2ShelvesPlain": {
  "1": {
   "id": "recwGGwfPaPwgnlC3",
   "name": "Hilla",
   "sku": "H1"
  },
  "2": {
   "id": "recViuQMmaNp5teAu",
   "name": "2 hillur",
   "sku": "H2"
  },
  "3": {
   "id": "recdGmqHb3MfW7mgc",
   "name": "3 hillur",
   "sku": "H3"
  },
  "4": {
   "id": "rec3P45azIYjXEtOM",
   "name": "4 hillur",
   "sku": "H4"
  },
  "5": {
   "id": "recCPTrQkijuVhLAi",
   "name": "5 hillur",
   "sku": "H5"
  }
 },
 "v2ShelvesFrontaefni": {
  "1": {
   "id": "recxwvKdx0GCahWlQ",
   "name": "Hilla úr frontaefni",
   "sku": "FREH1"
  },
  "2": {
   "id": "recS8m90SyDm0SQbt",
   "name": "2 hillur úr frontaefni",
   "sku": "FREH2"
  },
  "3": {
   "id": "reccHklnjHICTW1oP",
   "name": "3 hillur úr frontaefni",
   "sku": "FREH3"
  },
  "4": {
   "id": "rechzpKVua6jHlaft",
   "name": "4 hillur úr frontaefni",
   "sku": "FREH4"
  },
  "5": {
   "id": "recDrqfQFgZaTmrZQ",
   "name": "5 hillur úr frontaefni",
   "sku": "FREH5"
  }
 },
 "ofn": {
  "legra": {
   "KKKK": {
    "id": "rec36T9SYjGrtd65Q",
    "name": "Ofnaskápur - Legra - 4 K-skúffur og skápur f. ofan ofn | 2 loft.hillur | loftunarrist",
    "sku": "OFN4L"
   },
   "MMC": {
    "id": "rec9zm12ZKHv5WO6t",
    "name": "Ofnaskápur - Legra - CMM-skúffu sams. | skápur f. ofan ofn | 2 loft.hillur | loftunarrist",
    "sku": "OFN5L"
   },
   "CC+IM": {
    "id": "recCzX7xle4X5HQ2o",
    "name": "Ofnaskápur - Legra - 2 C-skúffur | 1 M-Innskúffa og skápur f. ofan ofn | 2 loft.hillur | loftunarrist",
    "sku": "OFN2L"
   },
   "CC": {
    "id": "recEf2bD4ZrmfbSRu",
    "name": "Ofnaskápur - Legra - 2 C-skúff. og skápur f. ofan ofn | 2 loft.hillur | loftunarrist",
    "sku": "OFN1L"
   },
   "MKC": {
    "id": "recjSovTzfUImVwua",
    "name": "Ofnaskápur - Legra -CKM skúffu sams. | skápur f. ofan ofn | 2 loft.hillur | loftunarrist",
    "sku": "OFN3L"
   }
  },
  "merivo": {
   "MKE": {
    "id": "rec7DAPLLhIK1qVzp",
    "name": "Ofnaskápur - Merivo - EKM skúffu sams. | skápur f. ofan ofn | 2 loftunarhillur | loftunarrist",
    "sku": "OFN3M"
   },
   "MME": {
    "id": "recBwRFrxW6jNTDFs",
    "name": "Ofnaskápur - Merivo - EMM-skúffu sams. | skápur f. ofan ofn | 2 loftunarhillur | loftunarrist",
    "sku": "OFN5M"
   },
   "KKKK": {
    "id": "recgeGtcx6cKbj0PD",
    "name": "Ofnaskápur - Merivo - 4 K-skúffur | skápur f. ofan ofn | 2 loftunarhillur | loftunarrist",
    "sku": "OFN4M"
   },
   "EE": {
    "id": "recjjz3vDcFc1QW3J",
    "name": "Ofnaskápur - Merivo - 2 E-skúff. | skápur f. ofan ofn | 2 loftunarhillur | loftunarrist",
    "sku": "OFN1M"
   },
   "EE+IM": {
    "id": "recrsXibaRK56r9cv",
    "name": "Ofnaskápur - Merivo - 2 E-skúffur | 1 M-innskúffa | skápur f. ofan ofn | 2 loftunarhillur | loftunarrist",
    "sku": "OFN2M"
   }
  }
 },
 "ofnLow": {
  "legra": {
   "id": "rec8VVeNzVvOmOtld",
   "name": "Lágur ofnaskápur - Legra - K-skúffa í botni | loftunarrist",
   "sku": "OFN6L"
  },
  "merivo": {
   "id": "recpSU5w6xvJiEFpn",
   "name": "Lágur ofnaskápur - Merivo - K-skúffa í botni | loftunarrist",
   "sku": "OFN6M"
  }
 },
 "ofnNoDrawers": {
  "id": "rec16FRmbo5D1ZYgg",
  "name": "Ofnaskápur - Skápur fyrir ofan og neðan ofn | loftunarrist",
  "sku": "OFN7"
 },
 "bur": {
  "legra": {
   "MKCC": {
    "id": "rec0s1YRdViC3UmFa",
    "name": "Búrskápur - Legra - 2 C-skúffur | 1 K-skúffur | 1 M-skúffa | 2 hillur",
    "sku": "BUR3L"
   },
   "KKCCC": {
    "id": "recJhlI8hMhLCtwBp",
    "name": "Búrskápur - Legra - 3 C-skúffur | 2 K-skúffur | 2 hillur",
    "sku": "BUR2L"
   },
   "MMKCCC": {
    "id": "recoYyot0AAstd0tx",
    "name": "Búrskápur - Legra - 3 C-skúffur | 1 K-skúffur | 2 M-skúffa | 2 hillur",
    "sku": "BUR4L"
   },
   "MMKKCC": {
    "id": "recwTgzq5UBO5fQmf",
    "name": "Búrskápur - Legra - 2 C-skúffur | 2 K-skúffur | 2 M-skúffur | 2 hillur",
    "sku": "BUR1L"
   }
  },
  "merivo": {
   "MMKKEE": {
    "id": "rec52PZezMjzg9vDy",
    "name": "Búrskápur - Merivo - 2 E-skúffur | 2 K-skúffur |2 M-skúffur | 2 hillur",
    "sku": "BUR1M"
   },
   "MMKEEE": {
    "id": "recCkbRGydW1qhdVl",
    "name": "Búrskápur - Merivo - 3 E-skúffur | 1 K-skúffur | 2 M-skúffa | 2 hillur",
    "sku": "BUR4M"
   },
   "NMKKE": {
    "id": "recVn9zkNAB1xA1QV",
    "name": "Búrskápur - MERIVO 1 E-skúffa | 2 K-skúffur | 1 M-skúffur | 1 N-skúffa",
    "sku": "BURM5"
   },
   "KKEEE": {
    "id": "reclBrFWOagvsgRqs",
    "name": "Búrskápur -Merivo - 3 E-skúffur | 2 K-skúffur | 2 hillur",
    "sku": "BUR2M"
   },
   "MKEE": {
    "id": "recwBzVSglgYiertk",
    "name": "Búrskápur - Merivo - 2 E-skúffur | 1 K-skúffur  | 1 M-skúffa | 2 hillur",
    "sku": "BUR3M"
   }
  }
 },
 "isskapur": {
  "id": "rec12hGwoHkkVn3kU",
  "name": "Innbyggður ísskápur | 2 Loftunarhillur | Loftunarrist",
  "sku": "LAMISSK"
 },
 "thvottavel": {
  "legra": {
   "id": "recG1QNtBpUeSVA8P",
   "name": "Þvottavélask. - Legra - F-skúffa | skápur f. ofan og 2 loftunarhillur",
   "sku": "THVO1L"
  },
  "merivo": {
   "id": "rec3pEv4NM5cYJiD3",
   "name": "Þvottavélask. - Merivo - E-skúffa | Skápur f. ofan og 2 loftunarhillur",
   "sku": "THVO1M"
  },
  "doors": {
   "id": "recKKsq9JPJdswSyv",
   "name": "Þvottavélask. lamaframhliðar og 4 loftunarhillur",
   "sku": "THVO2"
  }
 },
 "rusl": {
  "600": {
   "id": "recCJYumHBZ0JnnWg",
   "name": "2 8 ltr. ruslafötur og 2 17 ltr. og motta í botn skúffu",
   "sku": "RUSL60"
  },
  "800": {
   "id": "recv9FeELdwuaR5yU",
   "name": "3 stk 8 ltr. ruslafötur og 3 stk 17 ltr. og motta í botn skúffu",
   "sku": "RUSL80"
  }
 },
 "uppthvottavel": {
  "id": "recXEZO9ankz6N9M5",
  "name": "Uppþvottavélafrontur",
  "sku": "UÞVFR"
 }
};
