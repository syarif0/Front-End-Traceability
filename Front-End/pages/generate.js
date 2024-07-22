import React, { useState } from "react";
import QRCode from 'qrcode'; 
import styles from "../styles/Home.module.css";
import { createClient } from "@supabase/supabase-js";

// Supabase credentials
const supabaseUrl = "https://gauxhtapvigvxlbsjmbv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhdXhodGFwdmlndnhsYnNqbWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcwNzMyMDEsImV4cCI6MjAzMjY0OTIwMX0.HKu0bu4807rVC7R53IMdZLwkTHy2DX1LHkwCZpg7PVI";
const supabase = createClient(supabaseUrl, supabaseKey); 

function Generate() {
  const [qrCodeImage, setQrCodeImage] = useState(null); 

  const handleGenerate = async () => {
    try {
      // 1. Retrieve the latest ID_Kerat from Supabase
      const { data: latestKerat, error: retrievalError } = await supabase
        .from("Kerat")
        .select("ID_Kerat")
        .order("ID_Kerat", { ascending: false }) // Assuming ID_Kerat is stored as a string
        .limit(1);

      if (retrievalError) {
        console.error("Error retrieving latest ID_Kerat:", retrievalError);
        return;
      }

      // 2. Generate the next ID_Kerat
      let newIdKerat = "K001"; // Default if no records found
      if (latestKerat && latestKerat.length > 0) {
        const lastIdNumber = parseInt(latestKerat[0].ID_Kerat.substring(1)); 
        const nextIdNumber = lastIdNumber + 1;
        newIdKerat = `K${nextIdNumber.toString().padStart(3, '0')}`;
      }
      console.log("New ID_Kerat:", newIdKerat);

      // 3. Insert the new row with the generated ID_Kerat
      const { data: newRow, error: insertError } = await supabase
        .from("Kerat")
        .insert({ ID_Kerat: newIdKerat })
        .select();

      if (insertError) {
        console.error("Error adding new row:", insertError);
        return;
      }

      // Generate QR code (using newIdKerat directly)
      QRCode.toDataURL(newIdKerat, {
        width: 256,
        height: 256,
        margin: 2 
      }, (err, url) => {
        if (err) {
          console.error("Error generating QR code:", err);
          return;
        }
        setQrCodeImage(url); 
      });

    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  return (
    <div className={styles.main}>
      {qrCodeImage && ( 
        <img src={qrCodeImage} alt="QR Code" className={styles.containerColumn} />
      )}
      <button className={styles.button} onClick={handleGenerate}>
        Generate
      </button>
    </div>
  );
}

export default Generate;
