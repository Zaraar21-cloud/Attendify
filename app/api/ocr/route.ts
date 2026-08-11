import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Disabling body parsing since we are using formData() which NextRequest supports natively.
export const maxDuration = 120; // OCR takes time, let's give it up to 120 seconds if deployed (only applies to pro/enterprise, but good practice).

/**
 * Detect the correct python command for the current platform.
 * Tries "python" first (Windows default), then "python3" (Linux/macOS).
 */
async function getPythonCommand(): Promise<string> {
  return new Promise((resolve) => {
    exec("python --version", { timeout: 5000 }, (error) => {
      if (!error) {
        resolve("python");
      } else {
        exec("python3 --version", { timeout: 5000 }, (error2) => {
          resolve(error2 ? "python" : "python3"); // fallback to "python" even if both fail
        });
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    // Convert the File object to a Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Save buffer to a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `ocr_upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`);
    fs.writeFileSync(tempFilePath, buffer);

    // Resolve python script path
    const pythonScriptPath = path.resolve(process.cwd(), "better_ocr.py");

    // Detect python command
    const pythonCmd = await getPythonCommand();

    // Execute python script with a 45-second timeout
    return new Promise<NextResponse>((resolve) => {
      exec(
        `${pythonCmd} "${pythonScriptPath}" "${tempFilePath}" --json`,
        {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf8", // Ensure UTF-8 output for stdout
          },
          cwd: process.cwd(),
          timeout: 115000, // 115 second timeout to prevent hanging
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer for large outputs
        },
        (error, stdout, stderr) => {
          // Cleanup temporary file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.error("Failed to delete temporary file:", e);
          }

          if (error) {
            console.error("Python OCR Error:", error.message);
            if (stderr) console.error("Stderr:", stderr);
            
            // Provide more specific error messages
            const isTimeout = error.killed || (error as any).signal === "SIGTERM";
            const errorMsg = isTimeout 
              ? "OCR processing timed out. Try a smaller or clearer image."
              : "Failed to process image with OCR.";
            
            resolve(
              NextResponse.json(
                { error: errorMsg },
                { status: 500 }
              )
            );
            return;
          }

          try {
            // PyTorch/EasyOCR may output warning logs to stdout, so we extract
            // the JSON array/object by scanning from the last line upward.
            const lines = stdout.trim().split('\n');
            let jsonStr = "";
            for (let i = lines.length - 1; i >= 0; i--) {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
                    jsonStr = trimmed;
                    break;
                }
            }

            if (!jsonStr) {
                throw new Error("No JSON found in stdout");
            }

            const data = JSON.parse(jsonStr);
            
            if (data.error) {
              resolve(NextResponse.json({ error: data.error }, { status: 500 }));
            } else {
              resolve(NextResponse.json({ data }, { status: 200 }));
            }
          } catch (parseError) {
            console.error("Failed to parse Python output.");
            console.error("Stdout:", stdout);
            if (stderr) console.error("Stderr:", stderr);
            resolve(
              NextResponse.json(
                { error: "Invalid response from OCR engine." },
                { status: 500 }
              )
            );
          }
        }
      );
    });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
