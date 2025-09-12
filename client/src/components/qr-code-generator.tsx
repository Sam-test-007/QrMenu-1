import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, Copy } from "lucide-react";
import type { Restaurant, MenuItem } from "@shared/schema";

interface QRCodeGeneratorProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
}

export default function QRCodeGenerator({ restaurant, menuItems }: QRCodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const { toast } = useToast();

  const generateQRLink = (tableNum?: string) => {
    let baseUrl = `${window.location.origin}/menu/${encodeURIComponent(restaurant.slug)}`;
    if (tableNum && tableNum.trim()) {
      baseUrl += `?table=${encodeURIComponent(tableNum.trim())}`;
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
    const canvas = document.querySelector('#qr-code-canvas canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      const filename = tableNumber 
        ? `${restaurant.slug}-table-${tableNumber}-qr.png`
        : `${restaurant.slug}-qr-menu.png`;
      link.download = filename;
      link.href = canvas.toDataURL();
      link.click();
    }
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
              Leave empty for general menu QR code, or enter a table number for table-specific QR codes
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
            
            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                {tableNumber ? `Table ${tableNumber} QR Code` : "Menu QR Code"}
              </h4>
              <p className="text-gray-600 mb-4">
                {tableNumber 
                  ? `Customers at table ${tableNumber} can scan this QR code to view your menu`
                  : "Customers can scan this QR code to view your menu instantly"
                }
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleDownloadQR} className="flex-1" data-testid="button-download-qr">
                <Download className="mr-2 h-4 w-4" />
                Download QR Code
              </Button>
              <Button variant="outline" onClick={handleCopyLink} className="flex-1" data-testid="button-copy-link">
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
