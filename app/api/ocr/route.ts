import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Disabling body parsing since we are using formData() which NextRequest supports natively.
export const maxDuration = 60; // OCR takes time, let's give it up to 60 seconds if deployed (only applies to pro/enterprise, but good practice).

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

    // Execute python script
    return new Promise((resolve) => {
      exec(
        `python "${pythonScriptPath}" "${tempFilePath}" --json`,
        {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf8", // Ensure UTF-8 output for stdout
          },
          cwd: process.cwd(),
        },
        (error, stdout, stderr) => {
          // Cleanup temporary file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.error("Failed to delete temporary file:", e);
          }

          if (error) {
            console.error("Python OCR Error:", error);
            console.error("Stderr:", stderr);
            resolve(
              NextResponse.json(
                { error: "Failed to process image with OCR." },
                { status: 500 }
              )
            );
            return;
          }

          try {
            // Stdout could have multiple lines if something else logged, but we try to parse the last line or find the array.
            // But we suppressed other logs with json_only, so stdout should just be the JSON string.
            // EasyOCR sometimes outputs warnings to stderr even when successful, we ignore them unless there's an error.
            
            // PyTorch might output warning logs to stdout (e.g. pin_memory warning), so we extract the JSON array.
            const lines = stdout.trim().split('\n');
            let jsonStr = "";
            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].startsWith("[") || lines[i].startsWith("{")) {
                    jsonStr = lines[i];
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
            console.error("Failed to parse Python output:", stdout);
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
