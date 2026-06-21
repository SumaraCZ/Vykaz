import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar, 
  Settings, 
  Trash2, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Printer, 
  Copy, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Check, 
  Info, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Plus,
  X,
  Calculator,
  ChevronDown,
  Edit2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { DayRecord, AppSettings, MonthSummary } from "./types";
import { 
  CZECH_MONTHS, 
  CZECH_DAYS_SHORT, 
  getCzechHolidaysForYear, 
  calculateDailyHours, 
  getDaysInMonth,
  minutesToTimeStr,
  parseTimeToMinutes
} from "./utils";

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  defaultArrival: "08:00",
  defaultDeparture: "16:00",
  defaultLunchTaken: true,
  dailyWorkFund: 7.5,
  employeeName: "",
};

export default function App() {
  // Current active date view (defaults to now)
  const [currentYear, setCurrentYear] = useState<number>(() => {
    return new Date().getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    return new Date().getMonth() + 1; // 1 - 12
  });

  // Global settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("vykaz_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Monthly records
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  
  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [editingDay, setEditingDay] = useState<DayRecord | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showPrintIframeModal, setShowPrintIframeModal] = useState<boolean>(false);
  const [isBackupSectionOpen, setIsBackupSectionOpen] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Template to fill standard work days
  const [templateArrival, setTemplateArrival] = useState<string>(settings.defaultArrival);
  const [templateDeparture, setTemplateDeparture] = useState<string>(settings.defaultDeparture);
  const [templateLunchTaken, setTemplateLunchTaken] = useState<boolean>(settings.defaultLunchTaken);
  const [templateInterruptionFrom, setTemplateInterruptionFrom] = useState<string>("");
  const [templateInterruptionTo, setTemplateInterruptionTo] = useState<string>("");

  // Refs for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger temporary notification
  const triggerNotif = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotif({ message, type });
    setTimeout(() => {
      setNotif(null);
    }, 8000);
  };

  // Keep template state in sync when settings change
  useEffect(() => {
    setTemplateArrival(settings.defaultArrival);
    setTemplateDeparture(settings.defaultDeparture);
    setTemplateLunchTaken(settings.defaultLunchTaken);
  }, [settings]);

  // Load monthly records from localStorage or generate defaults
  useEffect(() => {
    const storageKey = `vykaz_data_${currentYear}_${currentMonth}`;
    const saved = localStorage.getItem(storageKey);
    let loadedRecords: Record<string, DayRecord> = {};
    
    if (saved) {
      try {
        loadedRecords = JSON.parse(saved);
      } catch (e) {
        loadedRecords = {};
      }
    }

    // Ensure all days of the month exist
    const numDays = getDaysInMonth(currentYear, currentMonth);
    const holidays = getCzechHolidaysForYear(currentYear);
    const mergedRecords: Record<string, DayRecord> = {};
    let hasChanged = false;

    for (let d = 1; d <= numDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(currentMonth).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;
      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, etc.
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const holidayName = holidays[dateStr] || null;
      const isHoliday = !!holidayName;

      if (loadedRecords[dateStr]) {
        // Exists, ensure static attributes (like holiday or weekday) are updated if necessary
        mergedRecords[dateStr] = {
          ...loadedRecords[dateStr],
          dayOfWeek,
          dayNameShort: CZECH_DAYS_SHORT[dayOfWeek],
          isWeekend,
          isHoliday,
          holidayName,
        };
      } else {
        hasChanged = true;
        mergedRecords[dateStr] = {
          date: dateStr,
          dayOfWeek,
          dayNameShort: CZECH_DAYS_SHORT[dayOfWeek],
          isWeekend,
          isHoliday,
          holidayName,
          active: !isWeekend && !isHoliday, // defaulted active on workdays
          arrival: "",
          departure: "",
          interruptionFrom: "",
          interruptionTo: "",
          lunchTaken: settings.defaultLunchTaken,
          note: ""
        };
      }
    }

    setRecords(mergedRecords);

    if (hasChanged && Object.keys(loadedRecords).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(mergedRecords));
    }
  }, [currentYear, currentMonth, settings]);

  // Save records to local storage whenever they change
  const saveRecords = (updatedRecords: Record<string, DayRecord>) => {
    const storageKey = `vykaz_data_${currentYear}_${currentMonth}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
    setRecords(updatedRecords);
  };

  // Auto-save settings
  const saveSettings = (newSettings: AppSettings) => {
    localStorage.setItem("vykaz_settings", JSON.stringify(newSettings));
    setSettings(newSettings);
    triggerNotif("Nastavení bylo uloženo", "success");
  };

  // Navigations
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleDownloadPDF = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    triggerNotif("Připravuji a generuji PDF výkaz...", "info");

    // Small delay to ensure any layout changes are flushed details prior to snapshot
    setTimeout(async () => {
      const element = document.getElementById("printable-pdf-document");
      if (!element) {
        triggerNotif("Chyba: Nepodařilo se najít šablonu pro export.", "error");
        setIsGeneratingPDF(false);
        return;
      }

      try {
        const canvas = await html2canvas(element, {
          scale: 2, // High resolution crisp text
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const fileName = `vykaz_prace_${currentYear}_${String(currentMonth).padStart(2, '0')}.pdf`;
        pdf.save(fileName);
        triggerNotif("Výkaz odpracovaných hodin byl úspěšně stažen jako PDF!", "success");
      } catch (error) {
        console.error("PDF generator error:", error);
        triggerNotif("Při ukládání do PDF nastala chyba.", "error");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 250);
  };

  // Pre-fill working days of active month helper
  const handleAutoFill = () => {
    const updated = { ...records };
    let prefilledCount = 0;

    Object.keys(updated).forEach(dateStr => {
      const rec = updated[dateStr];
      // Only prefills standard working days that are NOT holidays and currently EMPTY
      if (!rec.isWeekend && !rec.isHoliday) {
        updated[dateStr] = {
          ...rec,
          active: true,
          arrival: templateArrival,
          departure: templateDeparture,
          lunchTaken: templateLunchTaken,
          interruptionFrom: templateInterruptionFrom,
          interruptionTo: templateInterruptionTo,
        };
        prefilledCount++;
      }
    });

    saveRecords(updated);
    triggerNotif(`Předvyplněno ${prefilledCount} pracovních dní`, "success");
  };

  // Clear all data for current month
  const handleClearMonth = () => {
    if (!window.confirm("Opravdu chcete vymazat všechna data pro tento měsíc?")) {
      return;
    }
    const updated = { ...records };
    Object.keys(updated).forEach(dateStr => {
      const rec = updated[dateStr];
      updated[dateStr] = {
        ...rec,
        arrival: "",
        departure: "",
        interruptionFrom: "",
        interruptionTo: "",
        lunchTaken: settings.defaultLunchTaken,
        note: "",
        active: !rec.isWeekend && !rec.isHoliday,
      };
    });
    saveRecords(updated);
    triggerNotif("Všechna data pro tento měsíc byla vymazána", "info");
  };

  // Update a single field in a day's record
  const updateDayField = (dateStr: string, field: keyof DayRecord, value: any) => {
    const updatedRecord = {
      ...records[dateStr],
      [field]: value
    };

    // If filling times, mark active automatically
    if (field === 'arrival' || field === 'departure') {
      if (value && !updatedRecord.active) {
        updatedRecord.active = true;
      }
    }

    const updated = {
      ...records,
      [dateStr]: updatedRecord
    };
    saveRecords(updated);
  };

  // Copy values from previous day
  const handleCopyPrevDay = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    if (records[prevDateStr]) {
      const src = records[prevDateStr];
      const updated = {
        ...records,
        [dateStr]: {
          ...records[dateStr],
          arrival: src.arrival,
          departure: src.departure,
          interruptionFrom: src.interruptionFrom,
          interruptionTo: src.interruptionTo,
          lunchTaken: src.lunchTaken,
          active: src.active,
          note: src.note,
        }
      };
      saveRecords(updated);
      triggerNotif(`Zkopírovány hodnoty z ${dateObj.getDate()}.${dateObj.getMonth() + 1}.`, "success");
    } else {
      triggerNotif("Předchozí den nemá žádný záznam v tomto měsíci.", "error");
    }
  };

  // Trigger quick click pre-fill for single day
  const handleQuickFillDay = (dateStr: string) => {
    const rec = records[dateStr];
    const isCurrentlyEmpty = !rec.arrival && !rec.departure;
    
    const updated = {
      ...records,
      [dateStr]: {
        ...rec,
        active: true,
        arrival: isCurrentlyEmpty ? settings.defaultArrival : "",
        departure: isCurrentlyEmpty ? settings.defaultDeparture : "",
        lunchTaken: settings.defaultLunchTaken,
        interruptionFrom: "",
        interruptionTo: "",
      }
    };
    saveRecords(updated);
  };

  // Calculations for stats
  let totalWorkedDecimal = 0;
  let workdaysInMonthCount = 0;
  let activeWorkedDaysCount = 0;

  // Let's count days and hours in active month view
  Object.keys(records).forEach(dateStr => {
    const rec = records[dateStr];
    
    // Day counts toward working fund only if it is NOT a weekend and NOT a holiday
    if (!rec.isWeekend && !rec.isHoliday) {
      workdaysInMonthCount++;
    }

    if (rec.arrival && rec.departure) {
      const { roundedHours } = calculateDailyHours(
        rec.arrival,
        rec.departure,
        rec.interruptionFrom,
        rec.interruptionTo,
        rec.lunchTaken
      );
      totalWorkedDecimal += roundedHours;
      if (roundedHours > 0) {
        activeWorkedDaysCount++;
      }
    }
  });

  const totalRequiredHours = workdaysInMonthCount * settings.dailyWorkFund;
  const overtimeBalance = totalWorkedDecimal - totalRequiredHours;

  // Export to CSV
  const handleExportCSV = () => {
    // CSV headers optimized for Czech excel (semicolons, decimals, cp1250 compatible)
    let csvContent = "\ufeff"; // BOM for excel utf8 encoding
    csvContent += "Datum;Den;Typ dne;Příchod;Odchod;Přerušení Od;Přerušení Do;Oběd pauza;Hodiny (Desetinné);Poznámka\r\n";

    Object.keys(records).sort().forEach(dateStr => {
      const rec = records[dateStr];
      const dateParts = dateStr.split('-');
      const formattedDate = `${parseInt(dateParts[2])}.${parseInt(dateParts[1])}.${dateParts[0]}`;
      
      let dayType = "Pracovní den";
      if (rec.isWeekend) dayType = "Víkend";
      if (rec.isHoliday) dayType = `Svátek: ${rec.holidayName}`;

      const { roundedHours } = calculateDailyHours(
        rec.arrival,
        rec.departure,
        rec.interruptionFrom,
        rec.interruptionTo,
        rec.lunchTaken
      );

      const parts = [
        formattedDate,
        rec.dayNameShort,
        dayType,
        rec.arrival || "",
        rec.departure || "",
        rec.interruptionFrom || "",
        rec.interruptionTo || "",
        rec.lunchTaken ? "Ano" : "Ne",
        roundedHours.toFixed(2).replace('.', ','), // Semicolon uses comma decimals in Czech
        rec.note || ""
      ];

      csvContent += parts.map(val => `"${val.replace(/"/g, '""')}"`).join(";") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vykaz_hodin_${currentYear}_${String(currentMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotif("CSV soubor byl úspěšně vyexportován", "success");
  };

  // JSON Data Backup & Restore
  const handleDownloadBackup = () => {
    const backupData: Record<string, any> = {
      version: 1,
      settings,
      data: {}
    };

    // Grab all keys starting with "vykaz_data_"
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vykaz_data_")) {
        try {
          backupData.data[key] = JSON.parse(localStorage.getItem(key) || "{}");
        } catch (e) {}
      }
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zaloha_vykazu_hodin_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotif("Záloha byla úspěšně stažena", "success");
  };

  const handleUploadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && json.data) {
          // Restore settings
          if (json.settings) {
            localStorage.setItem("vykaz_settings", JSON.stringify(json.settings));
            setSettings(json.settings);
          }
          // Restore data
          Object.keys(json.data).forEach(key => {
            if (key.startsWith("vykaz_data_")) {
              localStorage.setItem(key, JSON.stringify(json.data[key]));
            }
          });
          // Refresh page status
          const storageKey = `vykaz_data_${currentYear}_${currentMonth}`;
          const currentMonthSaved = localStorage.getItem(storageKey);
          if (currentMonthSaved) {
            setRecords(JSON.parse(currentMonthSaved));
          }
          triggerNotif("Záloha byla úspěšně obnovena!", "success");
          setIsBackupSectionOpen(false);
        } else {
          triggerNotif("Neplatný formát souboru zálohy", "error");
        }
      } catch (err) {
        triggerNotif("Nepodařilo se přečíst soubor zálohy", "error");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Quick helper to fill a day with standard times in one click
  const setStandardDayTimes = (dateStr: string) => {
    const rec = records[dateStr];
    const updated = {
      ...records,
      [dateStr]: {
        ...rec,
        active: true,
        arrival: settings.defaultArrival,
        departure: settings.defaultDeparture,
        lunchTaken: settings.defaultLunchTaken,
        interruptionFrom: "",
        interruptionTo: "",
      }
    };
    saveRecords(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-12 print:bg-white print:pb-0">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {notif && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm md:text-base ${
              notif.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : notif.type === "error" 
                ? "bg-rose-50 text-rose-800 border-rose-200" 
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            {notif.type === "success" && <Check className="w-5 h-5 text-emerald-500 shrink-0" />}
            {notif.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />}
            {notif.type === "info" && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
            <span className="font-medium">{notif.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Výkaz odpracovaných hodin</h1>
              <p className="text-xs text-slate-500 font-mono">Pracovní fond: {settings.dailyWorkFund}h denně • Český kalendář</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition"
              id="btn-global-settings"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Nastavení parametrů</span>
            </button>
            <button
              onClick={() => setIsBackupSectionOpen(!isBackupSectionOpen)}
              className="flex items-center space-x-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition"
              id="btn-backup-section"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Záloha dat</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md ${
                isGeneratingPDF 
                  ? "bg-slate-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
              }`}
              id="btn-print"
              title="Stáhnout měsíční výkaz ve formátu PDF"
            >
              {isGeneratingPDF ? (
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-indigo-200" />
              )}
              <span className="font-bold">
                {isGeneratingPDF ? "Generuji..." : "Stáhnout PDF"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 print:mt-0 print:px-0">
        
        {/* Backup / Recover section drawer */}
        <AnimatePresence>
          {isBackupSectionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-100 rounded-xl p-4 mb-6 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden"
            >
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Záloha a obnovení všech výkazů</h4>
                  <p className="text-xs text-slate-500">Můžete si stáhnout všechny uložené měsíce jako jeden soubor JSON do počítače a později ho nahrát zpět.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadBackup}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stáhnout zálohu (.json)</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nahrát zálohu (.json)</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadBackup}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calendar Nav & Auto Fill Panel */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-6 mb-6 print:shadow-none print:border-none print:p-0">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 print:hidden">
            
            {/* Year & Month Selection */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={handlePrevMonth}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
                title="Předchozí měsíc"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-2">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-base font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CZECH_MONTHS.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-base font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleNextMonth}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition"
                title="Následující měsíc"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Fill Actions (Desktop inline style) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-older flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Hromadný import:
              </span>
              
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <div>
                  <label className="text-3xs text-slate-400 block -mt-1 font-mono uppercase">Příchod</label>
                  <input
                    type="time"
                    value={templateArrival}
                    onChange={(e) => setTemplateArrival(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-3xs text-slate-400 block -mt-1 font-mono uppercase">Odchod</label>
                  <input
                    type="time"
                    value={templateDeparture}
                    onChange={(e) => setTemplateDeparture(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-3xs text-slate-400 block -mt-1 font-mono uppercase">Oběd pauza</label>
                  <select
                    value={templateLunchTaken ? "ano" : "ne"}
                    onChange={(e) => setTemplateLunchTaken(e.target.value === "ano")}
                    className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="ano">Ano (-30m)</option>
                    <option value="ne">Ne (přičíst k v.h.)</option>
                  </select>
                </div>
                
                <button
                  onClick={handleAutoFill}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition shadow-xs cursor-pointer inline-flex items-center space-x-1"
                >
                  <span>Vyplnit pracovní dny</span>
                </button>
              </div>
            </div>

            {/* Clear Month */}
            <button
              onClick={handleClearMonth}
              className="p-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition self-end md:self-auto"
              title="Smazat všechna data měsíce"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Heading for print */}
          <div className="hidden print:block text-center border-b pb-4 mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Měsíční výkaz práce</h1>
            <p className="text-lg text-slate-600 mt-1 font-semibold">
              Období: {CZECH_MONTHS[currentMonth - 1]} {currentYear}
            </p>
            <div className="flex justify-center space-x-8 text-sm mt-3 text-slate-500 font-mono">
              <span>Zaměstnanec: ______________________</span>
              <span>Pracovní fond: 7,5 hod denně</span>
            </div>
          </div>

          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            
            {/* Required Fund */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative overflow-hidden flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Pracovní Fond Měsíce
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {totalRequiredHours.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-xs text-slate-500 ml-1 font-semibold">hodin</span>
              </div>
              <p className="text-3xs text-slate-400 mt-2 font-mono">
                {workdaysInMonthCount} pracovních dní × {settings.dailyWorkFund}h
              </p>
            </div>

            {/* Total Worked */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative overflow-hidden flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Odpracované Hodiny
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600">
                  {totalWorkedDecimal.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-xs text-indigo-500 ml-1 font-semibold">hodin</span>
              </div>
              <p className="text-3xs text-slate-400 mt-2 font-mono">
                Skutečnost zadaná do výkazu ({activeWorkedDaysCount} aktivních dní)
              </p>
            </div>

            {/* Overtime / Balance */}
            <div className={`rounded-xl p-4 border relative overflow-hidden flex flex-col justify-between ${
              overtimeBalance >= 0 
                ? "bg-emerald-50/50 border-emerald-100 text-emerald-900" 
                : "bg-rose-50/50 border-rose-100 text-rose-900"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider block">
                Bilance / Přesčas
              </span>
              <div className="mt-2 flex items-baseline">
                <span className={`text-2xl sm:text-3xl font-black ${
                  overtimeBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {overtimeBalance >= 0 ? "+" : ""}{overtimeBalance.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-xs ml-1 font-semibold">hodin</span>
              </div>
              <p className="text-3xs mt-2 font-mono">
                {overtimeBalance >= 0 
                  ? "✓ Splněno (přesčas k čerpání)" 
                  : "⚠ Nesplněn fond (chybějící hodiny)"}
              </p>
            </div>

            {/* Calendar indicators */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative overflow-hidden flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Struktura Měsíce
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {Object.keys(records).length}
                </span>
                <span className="text-xs text-slate-500 ml-1 font-semibold">dní</span>
              </div>
              <p className="text-3xs text-slate-400 mt-2 font-mono">
                Fond: {workdaysInMonthCount} d • Víkendy/Svátky: {Object.keys(records).length - workdaysInMonthCount} d
              </p>
            </div>

          </div>

          {/* Quick instructions / rounding hint snippet */}
          <div className="mt-4 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 flex items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                <strong>Zaokrouhlování:</strong> Systém automaticky sčítá odpracované minuty a převádí dny na čtvrthodiny (<strong>15m = 0,25</strong> | <strong>30m = 0,50</strong> | <strong>45m = 0,75</strong>).
              </span>
            </div>
            <button
              onClick={handleExportCSV}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center space-x-1 shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Stáhnout CSV pro Excel</span>
            </button>
          </div>

        </div>

        {/* Timesheet Days List / Table Container */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden print:shadow-none print:border-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="timesheet-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider print:bg-slate-100">
                  <th className="px-3 py-3 w-12 text-center print:hidden">Akt</th>
                  <th className="px-3 py-3 w-32">Datum / Den</th>
                  <th className="px-3 py-3 w-40">Typ dne</th>
                  <th className="px-3 py-3 w-28">Příchod</th>
                  <th className="px-3 py-3 w-28">Odchod</th>
                  <th className="px-3 py-3 w-48">Přerušení od-do</th>
                  <th className="px-3 py-3 w-24 text-center">Oběd</th>
                  <th className="px-3 py-3 w-32 text-right">Odpracováno</th>
                  <th className="px-3 py-3 min-w-[150px]">Poznámka</th>
                  <th className="px-2 py-3 w-20 text-center print:hidden">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {Object.keys(records).sort().map(dateStr => {
                  const rec = records[dateStr];
                  const { exactTimeStr, roundedHours } = calculateDailyHours(
                    rec.arrival,
                    rec.departure,
                    rec.interruptionFrom,
                    rec.interruptionTo,
                    rec.lunchTaken
                  );

                  // Extract date parts
                  const dayObj = new Date(dateStr);
                  const dayInt = dayObj.getDate();
                  const isCurrentDay = (() => {
                    const today = new Date();
                    return today.getFullYear() === currentYear &&
                           (today.getMonth() + 1) === currentMonth &&
                           today.getDate() === dayInt;
                  })();

                  // Styling determinations
                  let rowBg = "hover:bg-slate-50/50";
                  let dayTypeLabel = "Pracovní fond";
                  let labelColor = "text-slate-500 font-medium";
                  
                  if (rec.isWeekend) {
                    rowBg = "bg-slate-50/20";
                    dayTypeLabel = "Víkend";
                    labelColor = "text-slate-400 font-semibold";
                  }
                  if (rec.isHoliday) {
                    rowBg = "bg-amber-50/10";
                    dayTypeLabel = `Svátek: ${rec.holidayName}`;
                    labelColor = "text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded text-xs inline-block";
                  }
                  if (isCurrentDay) {
                    rowBg = "bg-indigo-50/10 ring-1 ring-inset ring-indigo-100";
                  }

                  const isOvertime9 = roundedHours > 9;
                  if (rec.arrival && rec.departure && isOvertime9) {
                    rowBg = "bg-rose-50 hover:bg-rose-100/70 text-rose-950 border-rose-100 print:bg-rose-50/60";
                  }

                  return (
                    <tr 
                      key={dateStr} 
                      className={`${rowBg} transition relative`}
                    >
                      
                      {/* Active checkbox to toggle work tracking (desktop view) */}
                      <td className="px-3 py-2 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={rec.active}
                          onChange={(e) => updateDayField(dateStr, 'active', e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                          title="Kliknutím aktivujete vykazování hodin na tento den"
                        />
                      </td>

                      {/* Date & Day of week */}
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {isCurrentDay && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block mr-1" title="Dnes" />
                          )}
                          <span className={`text-base ${rec.isWeekend ? 'text-slate-400 font-medium' : 'text-slate-800'}`}>
                            {dayInt}.{currentMonth}.
                          </span>
                          <span className={`text-xs ml-1 font-semibold uppercase ${rec.isWeekend ? 'text-rose-400' : 'text-slate-500'}`}>
                            {rec.dayNameShort}
                          </span>
                        </div>
                      </td>

                      {/* Day description (work task / state holiday) */}
                      <td className="px-3 py-2">
                        <span className={labelColor}>
                          {rec.isHoliday ? rec.holidayName : rec.isWeekend ? "Víkend" : `Práce (${settings.dailyWorkFund} h)`}
                        </span>
                      </td>

                      {/* Arrival Input */}
                      <td className="px-2 py-2 min-w-[76px]">
                        <span className="hidden print:inline font-mono text-sm">
                          {rec.active ? (rec.arrival || "-") : ""}
                        </span>
                        <input
                          type="time"
                          value={rec.arrival}
                          onChange={(e) => updateDayField(dateStr, 'arrival', e.target.value)}
                          disabled={!rec.active}
                          className={`w-full px-2 py-1 text-sm font-mono text-slate-800 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 print:hidden ${
                            rec.active 
                              ? rec.arrival ? 'border-indigo-200 bg-indigo-50/5' : 'border-slate-200 bg-white' 
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Departure Input */}
                      <td className="px-2 py-2 min-w-[76px]">
                        <span className="hidden print:inline font-mono text-sm">
                          {rec.active ? (rec.departure || "-") : ""}
                        </span>
                        <input
                          type="time"
                          value={rec.departure}
                          onChange={(e) => updateDayField(dateStr, 'departure', e.target.value)}
                          disabled={!rec.active}
                          className={`w-full px-2 py-1 text-sm font-mono text-slate-800 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 print:hidden ${
                            rec.active 
                              ? rec.departure ? 'border-indigo-200 bg-indigo-50/5' : 'border-slate-200 bg-white' 
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Interruption From - To */}
                      <td className="px-2 py-2">
                        <span className="hidden print:inline font-mono text-xs">
                          {rec.active && rec.interruptionFrom && rec.interruptionTo 
                            ? `${rec.interruptionFrom} - ${rec.interruptionTo}` 
                            : rec.active && (rec.interruptionFrom || rec.interruptionTo)
                            ? `${rec.interruptionFrom || "-"} - ${rec.interruptionTo || "-"}`
                            : ""
                          }
                        </span>
                        <div className="flex items-center space-x-1 font-mono text-xs print:hidden">
                          <input
                            type="time"
                            value={rec.interruptionFrom}
                            onChange={(e) => updateDayField(dateStr, 'interruptionFrom', e.target.value)}
                            disabled={!rec.active}
                            className={`w-20 px-1.5 py-1 text-center border rounded-md focus:outline-hidden ${
                              rec.active 
                                ? rec.interruptionFrom ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200 bg-white' 
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            placeholder="Od"
                          />
                          <span className="text-slate-400">-</span>
                          <input
                            type="time"
                            value={rec.interruptionTo}
                            onChange={(e) => updateDayField(dateStr, 'interruptionTo', e.target.value)}
                            disabled={!rec.active}
                            className={`w-20 px-1.5 py-1 text-center border rounded-md focus:outline-hidden ${
                              rec.active 
                                ? rec.interruptionTo ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200 bg-white' 
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            placeholder="Do"
                          />
                        </div>
                      </td>

                      {/* Lunch taken Selection checkbox/button */}
                      <td className="px-3 py-2 text-center text-xs">
                        <span className="hidden print:inline font-semibold">
                          {rec.active ? (rec.lunchTaken ? "Ano" : "Ne") : ""}
                        </span>
                        <button
                          type="button"
                          disabled={!rec.active}
                          onClick={() => updateDayField(dateStr, 'lunchTaken', !rec.lunchTaken)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition print:hidden ${
                            !rec.active
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : rec.lunchTaken
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                              : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200"
                          }`}
                          title={rec.lunchTaken ? "Dedeuruje se standardní 30min oběd" : "Čas oběda je započítán do odpracovaných hodin"}
                        >
                          {rec.lunchTaken ? "Ano" : "Ne"}
                        </button>
                      </td>

                      {/* Calculated Hours Column */}
                      <td className="px-3 py-2 text-right">
                        {rec.arrival && rec.departure ? (
                          <div className="flex flex-col items-end">
                            <span className={`font-bold font-mono text-base ${isOvertime9 ? 'text-rose-600 font-extrabold' : 'text-slate-900'}`}>
                              {roundedHours.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-3xs text-slate-400 font-mono tracking-wide">
                              ({exactTimeStr} čistého)
                            </span>
                            {isOvertime9 && (
                              <span className="inline-block bg-rose-100 text-rose-800 text-[10px] font-semibold px-1 rounded-sm mt-0.5 font-sans shrink-0">
                                ⚠ Přes 9 hod!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Day specific Note input */}
                      <td className="px-2 py-2">
                        <span className="hidden print:inline text-xs">
                          {rec.active ? rec.note : ""}
                        </span>
                        <input
                          type="text"
                          value={rec.note}
                          onChange={(e) => updateDayField(dateStr, 'note', e.target.value)}
                          placeholder="Poznámka..."
                          disabled={!rec.active}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-400 print:hidden"
                        />
                      </td>

                      {/* Single Day Actions column (Quick action toggles) */}
                      <td className="px-2 py-2 text-center print:hidden">
                        <div className="flex items-center justify-center space-x-1">
                          
                          {/* Set standard quick times */}
                          <button
                            onClick={() => setStandardDayTimes(dateStr)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Vyplnit výchozí pracovní dobu"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy from previous day */}
                          {dayInt > 1 && (
                            <button
                              onClick={() => handleCopyPrevDay(dateStr)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                              title="Kopírovat z předchozího dne"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Quick clear day times */}
                          {(rec.arrival || rec.departure) && (
                            <button
                              onClick={() => {
                                updateDayField(dateStr, 'arrival', "");
                                updateDayField(dateStr, 'departure', "");
                                updateDayField(dateStr, 'interruptionFrom', "");
                                updateDayField(dateStr, 'interruptionTo', "");
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Vymazat tento den"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table print-only signature section footer */}
          <div className="hidden print:block mt-16 px-6 font-mono text-sm leading-relaxed text-slate-800">
            <div className="flex justify-between items-start mt-8">
              <div>
                <p className="mb-8">Vypracoval (Zaměstnanec):</p>
                <div className="border-t border-slate-400 w-64 pt-2">
                  <p>Datum a podpis: ............................</p>
                </div>
              </div>
              <div>
                <p className="mb-8">Schválil (Nadřízený):</p>
                <div className="border-t border-slate-400 w-64 pt-2">
                  <p>Datum a podpis: ............................</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Settings Modal Component Dialog Overlay */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 border border-slate-100"
            >
              <div className="p-6">
                
                <div className="flex items-center justify-between border-b pb-4 mb-5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg">Výchozí pracovní parametry</h3>
                  </div>
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  
                  {/* Jméno zaměstnance */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Jméno zaměstnance
                    </label>
                    <input
                      type="text"
                      placeholder="např. Lukáš Černý"
                      value={settings.employeeName || ""}
                      onChange={(e) => saveSettings({ ...settings, employeeName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 text-sm"
                    />
                    <p className="text-3xs text-slate-400 mt-1">
                      Bude zobrazeno na vygenerovaném PDF výkazu.
                    </p>
                  </div>
                  
                  {/* Default Arrival Time */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Výchozí příchod
                    </label>
                    <input
                      type="time"
                      value={settings.defaultArrival}
                      onChange={(e) => saveSettings({ ...settings, defaultArrival: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <p className="text-3xs text-slate-400 mt-1">
                      Tato pracovní doba bude předvyplněná pro nové pracovní dny.
                    </p>
                  </div>

                  {/* Default Departure Time */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Výchozí odchod
                    </label>
                    <input
                      type="time"
                      value={settings.defaultDeparture}
                      onChange={(e) => saveSettings({ ...settings, defaultDeparture: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Daily Work Fund standard */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Denní pracovní fond (hodiny)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={settings.dailyWorkFund}
                      onChange={(e) => saveSettings({ ...settings, dailyWorkFund: parseFloat(e.target.value) || 7.5 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <p className="text-3xs text-slate-400 mt-1">
                      Zákonný standard ČR pro jednosměnný režim je obvykle 7,5 nebo 8,0 hodin po odečtení pauzy.
                    </p>
                  </div>

                  {/* Lunch break behavior defaults */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-semibold text-slate-800 text-sm block">Automatická obědová pauza</label>
                        <span className="text-3xs text-slate-400">Při předvyplnění automaticky odečíst 30min oběd z hodin</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveSettings({ ...settings, defaultLunchTaken: !settings.defaultLunchTaken })}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                          settings.defaultLunchTaken ? "bg-indigo-600 justify-end" : "bg-slate-300 justify-start"
                        }`}
                      >
                        <span className="bg-white w-4 h-4 rounded-full shadow-sm" />
                      </button>
                    </div>
                  </div>

                </div>

                <div className="mt-6 pt-4 border-t flex justify-end">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-xs"
                  >
                    Hotovo • Použít
                  </button>
                </div>

              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* Off-screen Standard A4 printable document wrapper designed for pixel-perfect PDF export */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div 
          id="printable-pdf-document" 
          className="bg-white p-12 text-slate-800 font-sans w-[1000px]"
        >
          {/* Document Header */}
          <div className="flex justify-between items-center border-b-2 border-indigo-650 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">MĚSÍČNÍ VÝKAZ PRÁCE</h1>
              <p className="text-sm font-semibold text-indigo-600 mt-1">
                Generováno z docházkového systému
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono uppercase bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md font-bold">
                Období: {CZECH_MONTHS[currentMonth - 1]} {currentYear}
              </span>
              <p className="text-3xs text-slate-400 mt-2 font-mono">
                Datum vygenerování: {new Date().toLocaleDateString("cs-CZ")}
              </p>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">IDENTIFIKACE ZAMĚSTNANCE</h3>
                <div className="space-y-1.5 text-sm">
                  <div>
                    <span className="text-slate-500">Zaměstnanec:</span>{" "}
                    <strong className="text-slate-900 font-semibold">{settings.employeeName || "lcerny.cz@gmail.com"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Pracovní fond:</span>{" "}
                    <strong className="text-slate-900 font-semibold">{settings.dailyWorkFund} hod. denně</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Status výkazu:</span>{" "}
                    <strong className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-xs select-none">Schválený a uzavřený</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 grid grid-cols-3 gap-2 text-center items-center">
              <div>
                <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">Celkem odpracováno</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {totalWorkedDecimal.toFixed(2).replace('.', ',')} h
                </span>
                <span className="text-3xs text-slate-400 font-mono block mt-1">{activeWorkedDaysCount} dny v práci</span>
              </div>
              <div>
                <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">Měsíční Fond</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {totalRequiredHours.toFixed(2).replace('.', ',')} h
                </span>
                <span className="text-3xs text-slate-400 font-mono block mt-1">{workdaysInMonthCount} pracovních dní</span>
              </div>
              <div>
                <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">Saldo / Přesčas</span>
                <span className={`text-xl font-black font-mono mt-1 block ${overtimeBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {overtimeBalance >= 0 ? "+" : ""}{overtimeBalance.toFixed(2).replace('.', ',')} h
                </span>
                <span className="text-3xs text-slate-400 font-mono block mt-1">
                  {overtimeBalance >= 0 ? "Přesčas" : "Nedofond"}
                </span>
              </div>
            </div>
          </div>

          {/* Table of records */}
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase border-b border-slate-200">
                <th className="p-2 border border-slate-200 text-center w-12 font-bold">Datum</th>
                <th className="p-2 border border-slate-200 text-center w-10 font-bold">Den</th>
                <th className="p-2 border border-slate-200 w-24 font-bold">Typ dne</th>
                <th className="p-2 border border-slate-200 text-center w-20 font-bold">Příchod</th>
                <th className="p-2 border border-slate-200 text-center w-20 font-bold">Odchod</th>
                <th className="p-2 border border-slate-200 text-center w-24 font-bold">Přerušení</th>
                <th className="p-2 border border-slate-200 text-center w-14 font-bold">Oběd</th>
                <th className="p-2 border border-slate-200 text-right w-20 font-bold">Čistá doba</th>
                <th className="p-2 border border-slate-200 font-bold">Poznámka</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {Object.keys(records).sort().map(dateStr => {
                const rec = records[dateStr];
                const dateParts = dateStr.split('-');
                const formattedDate = `${parseInt(dateParts[2])}.${parseInt(dateParts[1])}.`;
                
                let rowBg = "bg-white";
                let dayLabel = "Pracovní den";
                let dayLabelStyle = "text-slate-600 font-medium";
                
                if (rec.isWeekend) {
                  rowBg = "bg-slate-50 text-slate-400";
                  dayLabel = "Víkend";
                  dayLabelStyle = "text-slate-400 font-normal";
                }
                if (rec.isHoliday) {
                  rowBg = "bg-amber-50/40 text-amber-900";
                  dayLabel = `Svátek`;
                  dayLabelStyle = "text-amber-700 font-semibold";
                }

                const { roundedHours } = calculateDailyHours(
                  rec.arrival,
                  rec.departure,
                  rec.interruptionFrom,
                  rec.interruptionTo,
                  rec.lunchTaken
                );

                const isOvertime9 = roundedHours > 9;
                if (rec.arrival && rec.departure && isOvertime9) {
                  rowBg = "bg-rose-50/60 text-slate-900";
                }

                return (
                  <tr key={dateStr} className={`${rowBg} border-b border-slate-200`}>
                    <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-900">{formattedDate}</td>
                    <td className="p-2 border border-slate-200 text-center text-slate-500 font-mono">{rec.dayNameShort}</td>
                    <td className="p-2 border border-slate-200">
                      <div className="flex flex-col">
                        <span className={dayLabelStyle}>{dayLabel}</span>
                        {rec.isHoliday && rec.holidayName && (
                          <span className="text-[10px] text-amber-600 block leading-tight font-sans truncate max-w-[125px]" title={rec.holidayName}>
                            {rec.holidayName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-mono">
                      {rec.active && rec.arrival ? rec.arrival : "-"}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-mono">
                      {rec.active && rec.departure ? rec.departure : "-"}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-mono text-slate-500">
                      {rec.active && rec.interruptionFrom && rec.interruptionTo 
                        ? `${rec.interruptionFrom} - ${rec.interruptionTo}` 
                        : rec.active && (rec.interruptionFrom || rec.interruptionTo)
                        ? `${rec.interruptionFrom || "-"} - ${rec.interruptionTo || "-"}`
                        : "-"
                      }
                    </td>
                    <td className="p-2 border border-slate-200 text-center text-slate-500 font-sans">
                      {rec.active ? (rec.lunchTaken ? "Ano" : "Ne") : "-"}
                    </td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-900">
                      {rec.arrival && rec.departure ? (
                        <span className={isOvertime9 ? "text-rose-600 font-extrabold" : ""}>
                          {roundedHours.toFixed(2).replace('.', ',')} h
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3 border border-slate-200 text-slate-600 italic font-sans max-w-[170px] truncate">
                      {rec.active && rec.note ? rec.note : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signature Block */}
          <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-200">
            <div className="text-center pt-8">
              <div className="border-t border-dashed border-slate-400 w-3/5 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Podpis zaměstnance</p>
              <p className="text-3xs text-slate-400 mt-1 font-mono">Datum: {new Date().toLocaleDateString("cs-CZ")}</p>
            </div>
            <div className="text-center pt-8">
              <div className="border-t border-dashed border-slate-400 w-3/5 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Schválil nadřízený</p>
              <p className="text-3xs text-slate-400 mt-1 font-mono">Datum: ............................</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
