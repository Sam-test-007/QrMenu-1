import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, Copy } from "lucide-react";
import type { Restaurant, MenuItem } from "@shared/schema";

interface QRCodeGeneratorProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
}

export default function QRCodeGenerator({
  restaurant,
  menuItems,
}: QRCodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const { toast } = useToast();

  const generateQRLink = (tableNum?: string) => {
    let baseUrl = `${window.location.origin}/menu/${encodeURIComponent(
      restaurant.slug
    )}`;
    if ((tableNum ?? "").trim()) {
      baseUrl += `?table=${encodeURIComponent((tableNum ?? "").trim())}`;
    }
    return baseUrl;
  };

  const qrLink = generateQRLink(tableNumber);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrLink);
      toast({
        title: "Success",
        description: "Link copied to clipboard!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.querySelector(
      "#qr-code-canvas canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    // Create an offscreen canvas to compose QR + text
    const qrSize = canvas.width; // includes margin
    const padding = 24;
    const textLines = [] as string[];
    if (restaurant.name) textLines.push(restaurant.name);
    if ((tableNumber ?? "").trim())
      textLines.push(`Table ${(tableNumber ?? "").trim()}`);

    const lineHeight = 20;
    const textAreaHeight =
      textLines.length > 0 ? textLines.length * lineHeight + padding : 0;

    const outWidth = qrSize + padding * 2;
    const outHeight = qrSize + textAreaHeight + padding * 2;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    // fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);

    // draw QR centered horizontally, leaving top padding
    const qrX = padding;
    const qrY = padding;

    // draw existing QR canvas into the new canvas
    ctx.drawImage(canvas, qrX, qrY, qrSize, qrSize);

    // draw text centered below QR
    if (textLines.length > 0) {
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const fontSize = 16;
      ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
      const centerX = outWidth / 2;
      let ty = qrY + qrSize + 12;
      for (const line of textLines) {
        ctx.fillText(line, centerX, ty);
        ty += lineHeight;
      }
    }

    const link = document.createElement("a");
    const filename = (tableNumber ?? "").trim()
      ? `${restaurant.slug}-table-${(tableNumber ?? "").trim()}-qr.png`
      : `${restaurant.slug}-qr-menu.png`;
    link.download = filename;
    link.href = outCanvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-generate-qr">
          <QrCode className="mr-2 h-4 w-4" />
          Generate QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate QR Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Table Number Input */}
          <div className="space-y-2">
            <Label htmlFor="table-number">Table Number (Optional)</Label>
            <Input
              id="table-number"
              placeholder="e.g., 1, A1, Table 5"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              data-testid="input-table-number"
            />
            <p className="text-xs text-gray-500">
              Leave empty for general menu QR code, or enter a table number for
              table-specific QR codes
            </p>
          </div>

          {/* QR Code Display */}
          <div className="text-center space-y-4">
            <div
              id="qr-code-canvas"
              className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block"
              data-testid="qr-code-display"
            >
              <QRCodeCanvas
                value={qrLink}
                size={192}
                level="M"
                includeMargin={true}
              />
            </div>
            {/* Live composed preview (downloaded image preview) */}

            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                {tableNumber ? `Table ${tableNumber} QR Code` : "Menu QR Code"}
              </h4>
              <p className="text-gray-600 mb-4">
                {tableNumber
                  ? `Customers at table ${tableNumber} can scan this QR code to view your menu`
                  : "Customers can scan this QR code to view your menu instantly"}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleDownloadQR}
                className="flex-1"
                data-testid="button-download-qr"
              >
                <Download className="mr-2 h-4 w-4" />
                Download QR Code
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="flex-1"
                data-testid="button-copy-link"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
