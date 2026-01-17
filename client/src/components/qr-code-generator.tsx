import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Restaurant, MenuItem } from "@shared/schema";

interface Table {
  id: string;
  table_number: number;
  name?: string;
  active: boolean;
}

interface QRCodeGeneratorProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
}

export default function QRCodeGenerator({
  restaurant,
  menuItems,
}: QRCodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [qrToken, setQrToken] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTables();
    }
  }, [open]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("tables")
        .select("id, table_number, name, active")
        .eq("restaurant_id", restaurant.id)
        .eq("active", true)
        .order("table_number");

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tables",
        variant: "destructive",
      });
    }
  };

  const generateSecureQR = async () => {
    if (!selectedTableId) {
      toast({
        title: "Error",
        description: "Please select a table",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/tables/${selectedTableId}/generate-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: "2m" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate token");
      }

      const data = await response.json();
      setQrToken(data.token);
      setSelectedTableId(selectedTableId); // Keep track of the table ID
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate secure QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const qrValue = selectedTableId
    ? `${window.location.origin}/menu/${restaurant.slug}?table=${selectedTableId}`
    : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrValue);
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

    const selectedTable = tables.find((t) => t.id === selectedTableId);
    const tableDisplay = selectedTable
      ? selectedTable.name || `Table ${selectedTable.table_number}`
      : "Menu";

    // Create an offscreen canvas to compose QR + text
    const qrSize = canvas.width;
    const padding = 24;
    const textLines = [restaurant.name, tableDisplay, "Scan to order"];

    const lineHeight = 20;
    const textAreaHeight = textLines.length * lineHeight + padding;

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

    // draw QR
    const qrX = padding;
    const qrY = padding;
    ctx.drawImage(canvas, qrX, qrY, qrSize, qrSize);

    // draw text
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `bold 16px Inter, Arial, sans-serif`;
    const centerX = outWidth / 2;
    let ty = qrY + qrSize + 12;
    for (const line of textLines) {
      ctx.fillText(line, centerX, ty);
      ty += lineHeight;
    }

    const link = document.createElement("a");
    const filename = selectedTable
      ? `${restaurant.slug}-table-${selectedTable.table_number}-qr.png`
      : `${restaurant.slug}-qr-menu.png`;
    link.download = filename;
    link.href = outCanvas.toDataURL("image/png");
    link.click();
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-generate-qr">
          <QrCode className="mr-2 h-4 w-4" />
          Generate Secure QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Secure QR Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Table Selection */}
          <div className="space-y-2">
            <Label htmlFor="table-select">Select Table</Label>
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name || `Table ${table.table_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Each table needs its own unique QR code for secure ordering
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateSecureQR}
            disabled={!selectedTableId || loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate QR Code
          </Button>

          {/* QR Code Display */}
          {selectedTableId && qrValue && (
            <div className="text-center space-y-4">
              <div
                id="qr-code-canvas"
                className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block"
                data-testid="qr-code-display"
              >
                <QRCodeCanvas
                  value={qrValue}
                  size={192}
                  level="M"
                  includeMargin={true}
                />
              </div>

              <div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedTable
                    ? selectedTable.name ||
                      `Table ${selectedTable.table_number}`
                    : "Menu"}{" "}
                  QR Code
                </h4>
                <p className="text-gray-600 mb-4">
                  Customers at this table can scan this QR code to place secure
                  orders
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
