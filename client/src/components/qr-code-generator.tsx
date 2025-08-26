import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
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
  const { toast } = useToast();

  const generateQRLink = () => {
    const payload = {
      name: restaurant.name,
      items: menuItems.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: 1
      }))
    };
    const encoded = btoa(JSON.stringify(payload));
    return `${window.location.origin}/menu/${encodeURIComponent(restaurant.slug)}?menu=${encodeURIComponent(encoded)}`;
  };

  const qrLink = generateQRLink();

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
      link.download = `${restaurant.slug}-qr-menu.png`;
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
          <DialogTitle>QR Code Menu</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-6">
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
            <h4 className="text-xl font-semibold text-gray-900 mb-2">Scan to View Menu</h4>
            <p className="text-gray-600 mb-6">Customers can scan this QR code to view your menu instantly</p>
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
      </DialogContent>
    </Dialog>
  );
}
