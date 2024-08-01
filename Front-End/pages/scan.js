import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { QrReader } from 'react-qr-reader';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from "../styles/Home.module.css";

const supabaseUrl = 'https://hosturl.supabase.co';
const supabaseKey = 'key';
const supabase = createClient(supabaseUrl, supabaseKey);

function Scan() {
  // Define state variables
  const [lokasi, setLokasi] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [pallet, setPallet] = useState(null);
  const [oven, setOven] = useState(null);
  const [palletOptions, setPalletOptions] = useState([]);
  const [ovenOptions, setOvenOptions] = useState([]);
  const [bahanBaku, setBahanBaku] = useState([]); 
  const [selectedBahanBaku, setSelectedBahanBaku] = useState(null); 
  const [jumlahBahanBaku, setJumlahBahanBaku] = useState(0);
  const [selectedSupplier, setSelectedSupplier] = useState(null); 
  const [jumlahBaglog, setJumlahBaglog] = useState('');
  const [usiaBibit, setUsiaBibit] = useState(new Date());
  const [nomorRak, setNomorRak] = useState('');
  const [baris, setBaris] = useState('');
  const [kolom, setKolom] = useState('');
  const [nomorKumbung, setNomorKumbung] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [palletResponse, ovenResponse, bahanBakuResponse] = await Promise.all([
          supabase.from('Pallet').select('ID_Pallet'),
          supabase.from('Oven').select('ID_Oven'),
          supabase.from('Bahan_Baku').select(`
              ID_Bahan_Baku,
              Nama_Bahan_Baku,
              Supplier:ID_Supplier (
                ID_Supplier,
                Nama_Supplier
              )
            `),
        ]);

        setPalletOptions(palletResponse.data.map((p) => ({ value: p.ID_Pallet, label: p.ID_Pallet })));
        setOvenOptions(ovenResponse.data.map((o) => ({ value: o.ID_Oven, label: o.ID_Oven })));

        // Update bahanBaku with the fetched data (no modifications needed here)
        setBahanBaku(bahanBakuResponse.data); 

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data. Please try again later.');
      }
    };

    fetchData();
  }, []);

  // Create unique options for Bahan Baku dropdown
  const uniqueBahanBakuOptions = [
    ...new Set(bahanBaku.map((bahan) => bahan.Nama_Bahan_Baku)),
  ].map((nama) => ({ value: nama, label: nama }));

  // Create options for Supplier dropdown (all suppliers)
  const allSupplierOptions = bahanBaku.map((bahan) => ({
    value: bahan.Supplier.ID_Supplier,
    label: bahan.Supplier.Nama_Supplier,
    bahanBaku: bahan.Nama_Bahan_Baku
  }));

  // Filter supplier options based on selected Bahan Baku
  const filteredSupplierOptions = allSupplierOptions.filter(
    (supplier) => supplier.bahanBaku === selectedBahanBaku
  );

  // Handler function untuk scanner QR
  const handleScan = (result, error) => {
    if (result) {
      setScanResult(result?.text);
      setError(null); // Reset error state on successful scan
    }
  
    if (error) {
      console.error('QR code scan error:', error);
      setError('QR code scanning failed. Please try again.'); 
    }
  };

  // Handler function untuk submit data
  const handleSubmit = async () => {
    setError(null); // Clear previous errors
    setIsLoading(true);

    try {
      if (!lokasi) {
        setError('Please select a Lokasi.');
        return;
      }

      if (
        (lokasi === 'Logging' && (!scanResult || !pallet)) ||
        (lokasi === 'Sterilisasi' && (!pallet || !oven)) ||
        (lokasi === 'Inokulasi' && (!scanResult || !jumlahBaglog || !usiaBibit)) ||
        (lokasi === 'Inkubasi Masuk' && (!scanResult || !nomorRak || !baris || !kolom)) ||
        (lokasi === 'Mixing' && (!selectedBahanBaku || !selectedSupplier || jumlahBahanBaku <= 0))
      ) {
        setError('Please fill in all required fields.');
        return;
      }

      if (lokasi === 'Logging') {
        await handleLoggingSubmit();
      } else if (lokasi === 'Mixing') {
        await handleMixingSubmit();
      } else if (lokasi === 'Sterilisasi') {
        await handleSterilisasiSubmit();
      } else if (lokasi === 'Inokulasi') {
        await handleInokulasiSubmit();
      } else if (lokasi === 'Inkubasi Masuk') {
        await handleInkubasiMasukSubmit();
      } else if (lokasi === 'Inkubasi Keluar') {
        await handleInkubasiKeluarSubmit();
      } else if (lokasi === 'Kumbung') {
        await handleKumbungSubmit();
      }
    } catch (err) {
      console.error('Error submitting data:', err);
      setError('Failed to submit data. Please try again later.'); 
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function untuk generate ID_Bahan_Baku
  const bahanBakuAbbreviations = {
    'Serbuk Kayu': 'SBK',
    'Polar': 'POL',
    'Kapur': 'KPR',
    'Tepung Jagung': 'TPJ',
    // ... Bahan baku lainnya
  };
  
  function generateBahanBakuID(namaBahanBaku, idSupplier) {
    const abbreviation = bahanBakuAbbreviations[namaBahanBaku];
    if (!abbreviation) {
      throw new Error(`No abbreviation found for Bahan Baku: ${namaBahanBaku}`);
    }
    return `${abbreviation}-${idSupplier}`;
  }


  // Helper function untuk generate ID_Komposisi
  async function generateKomposisiID(idBahanBaku) {
    // 1. Extract Bahan Baku abbreviation (AAA) from ID_Bahan_Baku
    const bahanBakuAbbreviation = idBahanBaku.split('-')[0];
  
    // 2. Fetch existing Komposisi_Mixing records with the same abbreviation
    const { data: existingKomposisi, error: fetchError } = await supabase
      .from('Komposisi_Mixing')
      .select('ID_Komposisi')
      .filter('ID_Bahan_Baku', 'like', `${bahanBakuAbbreviation}%`); // Filter by abbreviation
  
    if (fetchError) {
      throw fetchError;
    }
  
    // 3. Find the highest existing numeric part (NNNN)
    let highestNum = 0;
    existingKomposisi.forEach((komposisi) => {
      const numericPart = parseInt(komposisi.ID_Komposisi.split('-')[2], 10);
      if (numericPart > highestNum) {
        highestNum = numericPart;
      }
    });
  
    // 4. Generate the new numeric part
    const newNumericPart = (highestNum + 1).toString().padStart(4, '0');
  
    // 5. Construct the new ID_Komposisi
    return `${idBahanBaku}-${newNumericPart}`;
  }


  // Helper function to generate ID_Segmen based on location and input
  const generateIDSegmen = (lokasi, nomorRak, baris, kolom) => {
    let lokasiNum = '';
    let formattedKolom = '';
  
    if (lokasi === 'Inkubasi') {
      lokasiNum = 'INK';
      formattedKolom = kolom;
    } else if (lokasi.startsWith('kumbung/')) {
      lokasiNum = `KMB/${lokasi.split('/')[1].padStart(2, '0')}`;
      formattedKolom = kolom;
      return `${lokasiNum}-${parseInt(nomorRak, 10)}${formattedKolom}${baris.toString().padStart(2, '0')}`; 
  
    } else {
      return null; // Invalid lokasi
    }
  
    return `${lokasiNum}-${nomorRak.toString().padStart(2, '0')}${formattedKolom}${baris.toString().padStart(2, '0')}`;
  };


  // Handler functions untuk setiap lokasi 

  const handleMixingSubmit = async () => {
    try { 
  
      // 1. Find the ID_Bahan_Baku based on selectedBahanBaku
      const selectedBahanBakuID = bahanBaku.find(
        (bahan) => bahan.Nama_Bahan_Baku === selectedBahanBaku
      )?.ID_Bahan_Baku;

      if (!selectedBahanBakuID) {
        setError('Invalid Bahan Baku selection.');
        return;
      }

      // 2. Deactivate previous Komposisi_Mixing
      await supabase
        .from('Komposisi_Mixing')
        .update({ Komposisi_Terbaru: false })
        .eq('Komposisi_Terbaru', true)
        .eq('ID_Bahan_Baku', selectedBahanBakuID); // Now you can use selectedBahanBakuID

      // 3. Generate ID_Bahan_Baku (using the existing function)
      const idBahanBaku = generateBahanBakuID(selectedBahanBaku, selectedSupplier);

      // 4. Generate ID_Komposisi (using the existing function)
      const idKomposisi = await generateKomposisiID(idBahanBaku); 

      // 5. Create the new Komposisi_Mixing 
      const { data: newKomposisi, error: komposisiError } = await supabase
        .from('Komposisi_Mixing')
        .insert([
          {
            ID_Komposisi: idKomposisi, 
            ID_Bahan_Baku: idBahanBaku,
            Jumlah_Digunakan: jumlahBahanBaku,
            Komposisi_Terbaru: true,
          },
        ])
        .select('ID_Komposisi');

        
      alert('Mixing data submitted successfully!');
    } catch (error) {
      console.error('Error in handleMixingSubmit:', error);
      setError('Failed to submit Mixing data.');
    }
  };
  

  const handleLoggingSubmit = async () => {
    try {
      // Get ID_Kerat from the scanned QR code
      const ID_Kerat = scanResult;

      // 1. Validate ID_Kerat format (using regular expression)
      if (!/^K\d{3}$/.test(ID_Kerat)) { // Update regex for "K001" format
        setError('Please scan a valid QR code (format: K###).'); 
        return;
      }

      // 2. Create a new BatchProduksi, including ID_Pallet
      const { data: newBatch, error: batchError } = await supabase
        .from('BatchProduksi')
        .insert([
          {
            ID_Kerat: ID_Kerat, // ID_Kerat is now a string
            Penggunaan_Kerat: true, 
            Status_Sterilisasi: 0, 
            ID_Pallet: pallet,
          },
        ])
        .select('ID_BatchProduksi');

      // 3. Fetch ALL active Komposisi_Mixing records 
      const { data: activeKomposisiList, error: komposisiError } = await supabase
        .from('Komposisi_Mixing')
        .select('ID_Komposisi') 
        .eq('Komposisi_Terbaru', true);

      if (komposisiError) {
        throw komposisiError; 
      }

      if (activeKomposisiList.length === 0) {
        setError('No active mixing compositions found. Please submit mixing data first.');
        return;
      }

      // 4. Create Mixing records for each active Komposisi_Mixing 
      const mixingInserts = activeKomposisiList.map((komposisi) => ({
        ID_BatchProduksi: newBatch[0].ID_BatchProduksi, 
        ID_Komposisi: komposisi.ID_Komposisi,
      }));

      const { error: mixingError } = await supabase // Unique error variable name
        .from('Mixing')
        .insert(mixingInserts);

      if (mixingError) {
        throw mixingError; 
      }

      alert('Logging data submitted successfully!');
    } catch (error) {
      console.error('Error in handleLoggingSubmit:', error);
      setError('Failed to submit Logging data.'); 
    }
  };


  const handleSterilisasiSubmit = async () => {
    try {
      // 1. Fetch ALL BatchProduksi records with Status_Sterilisasi = 0 and the selected pallet
      const { data: batchProduksiList, error: batchProduksiError } = await supabase
        .from('BatchProduksi')
        .select('ID_BatchProduksi')
        .eq('ID_Pallet', pallet) 
        .eq('Status_Sterilisasi', 0);
  
      if (batchProduksiError) {
        throw batchProduksiError;
      }
  
      if (batchProduksiList.length === 0) {
        setError('No unsterilized batches found for the selected pallet.');
        return;
      }
  
      // 2. Create Sterilisasi records for each batch
      const sterilisasiInserts = batchProduksiList.map((batch) => ({
        ID_Oven: oven,
        ID_BatchProduksi: batch.ID_BatchProduksi,
      }));
  
      const { error: sterilisasiError } = await supabase
        .from('Sterilisasi')
        .insert(sterilisasiInserts);
  
      if (sterilisasiError) {
        throw sterilisasiError;
      }
  
      // 3. Update Status_Sterilisasi in BatchProduksi for all processed batches
      const { error: updateError } = await supabase
        .from('BatchProduksi')
        .update({ Status_Sterilisasi: 1 })
        .in(
          'ID_BatchProduksi', 
          batchProduksiList.map(batch => batch.ID_BatchProduksi)
        ); 
  
      if (updateError) {
        throw updateError;
      }
  
      alert('Sterilisasi data submitted successfully!');
    } catch (error) {
      console.error('Error in handleSterilisasiSubmit:', error);
      setError('Failed to submit Sterilisasi data.');
    }
  };


  const handleInokulasiSubmit = async () => {
    try {
      // 1. Get ID_Kerat from the scanned QR code
      const ID_Kerat = scanResult;
  
      // 2. Get ID_BatchProduksi from BatchProduksi
      const { data: batchProduksi, error: batchProduksiError } = await supabase
        .from('BatchProduksi')
        .select('ID_BatchProduksi')
        .eq('ID_Kerat', ID_Kerat)
        .eq('Penggunaan_Kerat', true) 
        .single();
  
      if (batchProduksiError) {
        throw batchProduksiError;
      }
  
      if (!batchProduksi) {
        setError('No active batch found for the scanned Kerat.');
        return;
      }
  
      // 3. Create a new Inokulasi record
      const { error: inokulasiError } = await supabase
        .from('Inokulasi')
        .insert([
          {
            ID_BatchProduksi: batchProduksi.ID_BatchProduksi,
            Tanggal_buat_Inokulan: new Date(), 
            Jumlah_Baglog: parseInt(jumlahBaglog) || 15, 
          },
        ]);
  
      if (inokulasiError) {
        throw inokulasiError;
      }
  
      alert('Inokulasi data submitted successfully!');
    } catch (error) {
      console.error('Error in handleInokulasiSubmit:', error);
      setError('Failed to submit Inokulasi data.');
    }
  };


  const handleInkubasiMasukSubmit = async () => {
    try {
      const ID_Kerat = scanResult;
  
      // 1. Generate ID_Segmen
      const idSegmen = generateIDSegmen(
        'Inkubasi',
        parseInt(nomorRak, 10),
        parseInt(baris, 10),
        kolom
      );
  
      if (!idSegmen) {
        setError('Invalid input for ID_Segmen generation.');
        return;
      }
  
      // 2. Get the active BatchProduksi record for the scanned Kerat
      const { data: batchProduksi, error: batchProduksiError } = await supabase
        .from('BatchProduksi')
        .select('ID_BatchProduksi')
        .eq('ID_Kerat', ID_Kerat)
        .eq('Penggunaan_Kerat', true)
        .single();
  
      if (batchProduksiError) {
        throw batchProduksiError;
      }
  
      if (!batchProduksi) {
        setError('No active batch found for the scanned Kerat.');
        return;
      }
  
      // 3. Check if ID_Segmen already exists in Inkubasi
      /* 
      const { data: existingInkubasi, error: checkInkubasiError } = await supabase
        .from('Inkubasi')
        .select('ID_Segmen')
        .eq('ID_Segmen', idSegmen)
        .single();
  
      if (checkInkubasiError) {
        throw checkInkubasiError;
      }
  
      if (existingInkubasi) {
        setError('A batch is already assigned to this location in Inkubasi.');
        return;
      } 
      */
  
      // 4. Create a new Inkubasi record (this line number changes to 3)
      const { error: inkubasiError } = await supabase 
      .from('Inkubasi')
      .insert([
        {
          ID_BatchProduksi: batchProduksi.ID_BatchProduksi,
          ID_Segmen: idSegmen, 
        },
      ]);

      if (inkubasiError) {
        // Handle the error, potentially check for a duplicate key violation
        if (inkubasiError.code === '23505') { // Unique violation in PostgreSQL
            setError('A batch is already assigned to this location in Inkubasi.');
            return;
        } else {
            throw inkubasiError; 
        }
      }
  
      // 5. Update the Penggunaan_Kerat in BatchProduksi to 0 (inactive)
      const { error: updateError } = await supabase
        .from('BatchProduksi')
        .update({ Penggunaan_Kerat: false })
        .eq('ID_BatchProduksi', batchProduksi.ID_BatchProduksi);
  
      if (updateError) {
        throw updateError;
      }
  
      alert('Inkubasi Masuk data submitted successfully!');
    } catch (error) {
      console.error('Error in handleInkubasiMasukSubmit:', error);
      setError('Failed to submit Inkubasi Masuk data.');
    }
  };


  const handleInkubasiKeluarSubmit = async () => {
    try {
      const ID_Kerat = scanResult;
  
      // 1. Generate ID_Segmen
      const idSegmen = generateIDSegmen(
        'Inkubasi',
        parseInt(nomorRak, 10),
        parseInt(baris, 10),
        kolom
      );
  
      if (!idSegmen) {
        setError('Invalid input for ID_Segmen generation.');
        return;
      }
  
      // 2. Find the Inkubasi record with the matching ID_Segmen
      const { data: inkubasiRecord, error: inkubasiError } = await supabase
        .from('Inkubasi')
        .select('ID_Inkubasi, ID_BatchProduksi')
        .eq('ID_Segmen', idSegmen) 
        .single();
  
      if (inkubasiError) {
        throw inkubasiError;
      }
  
      if (!inkubasiRecord) {
        setError('No batch found for the specified location in Inkubasi.');
        return;
      }
  
      // 3. Update Inkubasi record with Waktu_Keluar
      const { error: updateInkubasiError } = await supabase
        .from('Inkubasi')
        .update({ Waktu_Keluar: new Date() })
        .eq('ID_Inkubasi', inkubasiRecord.ID_Inkubasi);
  
      if (updateInkubasiError) {
        throw updateInkubasiError;
      }
  
      // 4. Create a BatchTransfer record
      const { error: batchTransferError } = await supabase
        .from('BatchTransfer')
        .insert([
          {
            ID_Kerat: ID_Kerat,
            ID_Inkubasi: inkubasiRecord.ID_Inkubasi,
            ID_BatchProduksi: inkubasiRecord.ID_BatchProduksi,
            Jumlah_Baglog: parseInt(jumlahBaglog, 10),
            Penggunaan_Kerat: true,
          },
        ]);
  
      if (batchTransferError) {
        throw batchTransferError;
      }
  
      alert('Inkubasi Keluar data submitted successfully!');
    } catch (error) {
      console.error('Error in handleInkubasiKeluarSubmit:', error);
      setError('Failed to submit Inkubasi Keluar data.');
    }
  };
  

  const handleKumbungSubmit = async () => {
    try {
      const ID_Kerat = scanResult;
      const Nomor_Kumbung = parseInt(nomorKumbung, 10);
  
      // 1. Find the active BatchTransfer 
      const { data: latestBatchTransfer, error: batchTransferError } = await supabase
        .from('BatchTransfer')
        .select('ID_BatchTransfer, ID_Inkubasi')
        .eq('ID_Kerat', ID_Kerat)
        .eq('Penggunaan_Kerat', true)
        .single();
  
      if (batchTransferError) {
        throw batchTransferError;
      }
  
      if (!latestBatchTransfer) {
        setError('No active BatchTransfer found for the scanned Kerat.');
        return;
      }
  
      // 2. Generate ID_Segmen for Kumbung (using corrected generateIDSegmen)
      const idSegmen = generateIDSegmen(
        `kumbung/${Nomor_Kumbung}`,
        parseInt(nomorRak, 10),
        parseInt(baris, 10),
        kolom
      );
      console.log('Generated idSegmen:', idSegmen); // Log for debugging
  
      if (!idSegmen) {
        setError('Invalid input for ID_Segmen generation.');
        return;
      }
  
      // 3. Check if ID_Segmen already exists in Kumbung
      const { data: existingKumbung, error: checkKumbungError } = await supabase
        .from('Kumbung')
        .select('ID_Segmen')
        .eq('ID_Segmen', idSegmen) 
        .select(); 
  
      if (checkKumbungError) {
        throw checkKumbungError;
      }
  
      if (existingKumbung && existingKumbung.length > 0) {
        setError('A batch is already assigned to this location in Kumbung.');
        return;
      }
  
      // 4. Create a new Kumbung record
      const { error: kumbungError } = await supabase
        .from('Kumbung')
        .insert([
          {
            ID_Segmen: idSegmen,
            ID_BatchTransfer: latestBatchTransfer.ID_BatchTransfer,
          },
        ]);
  
      if (kumbungError) {
        throw kumbungError;
      }
  
      // 5. Update the previous BatchTransfer record to inactive
      const { error: updateError } = await supabase
        .from('BatchTransfer')
        .update({ Penggunaan_Kerat: false })
        .eq('ID_BatchTransfer', latestBatchTransfer.ID_BatchTransfer);
  
      if (updateError) {
        throw updateError;
      }
  
      alert('Kumbung data submitted successfully!');
    } catch (error) {
      console.error('Error in handleKumbungSubmit:', error);
      setError('Failed to submit Kumbung data.');
    }
  };


  return (
    <div className={styles.container}>
      <h2>{lokasi || 'Select a Location'}</h2>

      {error && <div className={styles.error}>{error}</div>}

      {/* Conditionally render QR scanner */}
      {(lokasi === 'Logging' ||
        lokasi === 'Inokulasi' ||
        lokasi === 'Inkubasi Masuk' ||
        lokasi === 'Inkubasi Keluar' ||
        lokasi === 'Kumbung') && (
        <QrReader
          onResult={handleScan}
          constraints={{ facingMode: 'environment' }}
          style={{ width: '40%', height: '40%' }}
        />
      )}
      
      {scanResult && <p>Scan Result (ID_Kerat): {scanResult}</p>}

      {/* Lokasi Dropdown */}
      <label htmlFor="lokasiDropdown">Lokasi:</label>
      <select
        id="lokasiDropdown"
        value={lokasi}
        onChange={(e) => {
          setLokasi(e.target.value);
          setError(null); 
        }}
      >
        <option value="">Select an option</option>
        <option value="Mixing">Mixing</option>
        <option value="Logging">Logging</option>
        <option value="Sterilisasi">Sterilisasi</option>
        <option value="Inokulasi">Inokulasi</option>
        <option value="Inkubasi Masuk">Masuk Inkubasi</option>
        <option value="Inkubasi Keluar">Keluar Inkubasi</option>
        <option value="Kumbung">Kumbung</option>
      </select>

      {/* --- Conditionally render form fields based on 'lokasi' --- */}

      {/* --- Logging Form --- */}
      {lokasi === 'Logging' && (
        <>
          <label htmlFor="palletDropdown"> <br></br> Nomor Pallet:</label>
          <select
            id="palletDropdown"
            value={pallet}
            onChange={(e) => setPallet(e.target.value)}
          >
            <option value="">Select Pallet</option>
            {palletOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}

      {/* --- Mixing Form --- */}
      {lokasi === 'Mixing' && (
        <>
          <span class="tab"></span>
          <label htmlFor="bahanBakuDropdown"> <br></br> Nama Bahan Baku:</label>
          <select
            id="bahanBakuDropdown"
            value={selectedBahanBaku || ''}
            onChange={(e) => {
              setSelectedBahanBaku(e.target.value);
              setSelectedSupplier(null); 
            }}
          >
            <option value="">Select Bahan Baku</option>
            {uniqueBahanBakuOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="supplierDropdown"> <br></br> Nama Supplier:</label>
          <select
            id="supplierDropdown"
            value={selectedSupplier || ''}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">Select Supplier</option>
            {filteredSupplierOptions.map((supplier) => ( 
              <option key={supplier.value} value={supplier.value}>
                {supplier.label}
              </option>
            ))}
          </select>

          
          <label htmlFor="jumlahInput"> <br></br> Jumlah:</label>
          <input
            type="number"
            id="jumlahInput"
            min="0"
            value={jumlahBahanBaku}
            onChange={(e) => setJumlahBahanBaku(parseInt(e.target.value) || 0)}
          />
        </>
      )}

      {/* --- Sterilisasi Form --- */}
      {lokasi === 'Sterilisasi' && (
        <>
          <label htmlFor="palletDropdownSterilisasi"> <br></br> Nomor Pallet:</label>
          <select
            id="palletDropdownSterilisasi"
            value={pallet} 
            onChange={(e) => setPallet(e.target.value)}
          >
            <option value="">Select Pallet</option>
            {palletOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="ovenDropdown"> <br></br> Oven:</label>
          <select
            id="ovenDropdown"
            value={oven}
            onChange={(e) => setOven(e.target.value)}
          >
            <option value="">Select Oven</option>
            {ovenOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}

      {/* --- Inokulasi Form --- */}
      {lokasi === 'Inokulasi' && (
        <>
          <label htmlFor="jumlahBaglogInput"> <br></br> Jumlah Baglog:</label>
          <input
            type="number" 
            id="jumlahBaglogInput"
            min="0" 
            value={jumlahBaglog}
            onChange={(e) => setJumlahBaglog(e.target.value)} 
          />

          <label htmlFor="usiaBibitPicker"> <br></br> Usia Bibit:</label>
          <DatePicker
            id="usiaBibitPicker"
            selected={usiaBibit}
            onChange={(date) => setUsiaBibit(date)}
            dateFormat="dd-MM-yyyy"
          />
        </>
      )}

      {/* --- Inkubasi Masuk Form --- */}
      {lokasi === 'Inkubasi Masuk' && (
        <>
          <label htmlFor="nomorRakInput"> <br></br> Nomor Rak:</label>
          <input
            type="text" 
            id="nomorRakInput"
            value={nomorRak}
            onChange={(e) => setNomorRak(e.target.value)}
          />

          <label htmlFor="barisInput"> <br></br> Baris:</label>
          <input
            type="text" 
            id="barisInput"
            value={baris}
            onChange={(e) => setBaris(e.target.value)}
          />

          <label htmlFor="kolomInput"> <br></br> Kolom:</label>
          <input
            type="text" 
            id="kolomInput"
            value={kolom}
            onChange={(e) => setKolom(e.target.value)}
          />
        </>
      )}

      {/* --- Inkubasi Keluar Form --- */}
      {lokasi === 'Inkubasi Keluar' && (
        <>
          <label htmlFor="nomorRakKeluarInput"> <br></br> Nomor Rak:</label>
          <input
            type="text" 
            id="nomorRakKeluarInput"
            value={nomorRak}
            onChange={(e) => setNomorRak(e.target.value)}
          />

          <label htmlFor="barisKeluarInput"> <br></br> Baris:</label>
          <input
            type="text" 
            id="barisKeluarInput"
            value={baris}
            onChange={(e) => setBaris(e.target.value)}
          />

          <label htmlFor="kolomKeluarInput"> <br></br> Kolom:</label>
          <input
            type="text" 
            id="kolomKeluarInput"
            value={kolom}
            onChange={(e) => setKolom(e.target.value)}
          />

          <label htmlFor="jumlahBaglogKeluarInput"> <br></br> Jumlah Baglog:</label>
          <input
            type="number" 
            id="jumlahBaglogKeluarInput"
            min="0" 
            value={jumlahBaglog}
            onChange={(e) => setJumlahBaglog(e.target.value)}
          />
        </>
      )}

      {/* --- Kumbung Form --- */}
      {lokasi === 'Kumbung' && (
        <>
          <label htmlFor="nomorKumbungInput"> <br></br> Nomor Kumbung:</label>
          <input
            type="text" 
            id="nomorKumbungInput"
            value={nomorKumbung}
            onChange={(e) => setNomorKumbung(e.target.value)}
          />
          
          <label htmlFor="nomorRakKumbungInput"> <br></br> Nomor Rak:</label>
          <input
            type="text" 
            id="nomorRakKumbungInput"
            value={nomorRak}
            onChange={(e) => setNomorRak(e.target.value)}
          />

          <label htmlFor="barisKumbungInput"> <br></br> Baris:</label>
          <input
            type="text" 
            id="barisKumbungInput"
            value={baris}
            onChange={(e) => setBaris(e.target.value)}
          />

          <label htmlFor="kolomKumbungInput"> <br></br> Kolom:</label>
          <input
            type="text" 
            id="kolomKumbungInput"
            value={kolom}
            onChange={(e) => setKolom(e.target.value)}
          />
        </>
      )}

      <label htmlFor="submitBtn"> <br></br> </label>
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  );
}

export default Scan;
