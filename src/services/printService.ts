// Simple ESC/POS Print Service using WebUSB and WebBluetooth

declare global {
  interface Navigator {
    usb?: any;
    bluetooth?: any;
  }
}

const ESC = '\x1b';
const GS = '\x1d';

export class PrintService {
  private device: any | null = null;

  async connect(type: string) {
    if (type === 'usb' || type === 'usb_58') {
      if (!navigator.usb) {
        throw new Error('WebUSB is not supported in this browser.');
      }
      try {
        const device = await navigator.usb.requestDevice({ filters: [] });
        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }
        await device.claimInterface(0);
        this.device = device;
        return true;
      } catch (err) {
        console.error('USB Connection Error:', err);
        throw err;
      }
    } else if (type === 'bluetooth') {
      if (!navigator.bluetooth) {
        throw new Error('WebBluetooth is not supported in this browser.');
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // standard printer service
        });
        this.device = device;
        return true;
      } catch (err) {
        console.error('Bluetooth Connection Error:', err);
        throw err;
      }
    } else if (type === 'network') {
      throw new Error('Network printing requires IP configuration (Not fully implemented).');
    }
    return false;
  }

  async printReceipt(data: any, settings: any) {
    if (!this.device) {
      throw new Error('Printer not connected');
    }

    let commands = '';

    // Initialize printer
    commands += ESC + '@';

    // Alignment Center
    commands += ESC + 'a' + '\x01';

    // Header
    if (settings.receiptHeader) {
      commands += settings.receiptHeader + '\n';
    }

    // Order Info
    commands += `Order ID: ${data.id}\n`;
    commands += `Date: ${new Date(data.date).toLocaleString()}\n`;
    commands += '--------------------------------\n';

    // Alignment Left
    commands += ESC + 'a' + '\x00';

    // Items
    data.items.forEach((item: any) => {
      commands += `${item.name}\n`;
      commands += `${item.quantity} x ${item.price} = ${item.quantity * item.price}\n`;
    });

    commands += '--------------------------------\n';

    // Alignment Right
    commands += ESC + 'a' + '\x02';

    commands += `Subtotal: ${data.subtotal}\n`;
    if (settings.showTaxOnReceipt) {
      commands += `Tax: ${data.tax}\n`;
    }
    commands += `Total: ${data.total}\n`;

    // Alignment Center
    commands += ESC + 'a' + '\x01';
    commands += '--------------------------------\n';

    // Footer
    if (settings.receiptFooter) {
      commands += settings.receiptFooter + '\n';
    }

    // Feed and cut
    commands += '\n\n\n\n';
    commands += GS + 'V' + '\x41' + '\x00';

    const encoder = new TextEncoder();
    const buffer = encoder.encode(commands);

    if (this.device && typeof this.device.transferOut === 'function') {
      try {
        await this.device.transferOut(1, buffer);
      } catch (err) {
        console.error('Print Error:', err);
        throw err;
      }
    } else if (this.device && this.device.gatt) {
      // Bluetooth printing logic
      try {
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        
        // Characteristic writes usually have a size limit (e.g., 512 bytes)
        const CHUNK_SIZE = 512;
        for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
          const chunk = buffer.slice(i, i + CHUNK_SIZE);
          await characteristic.writeValue(chunk);
        }
      } catch (err) {
        console.error('Bluetooth Print Error:', err);
        throw err;
      }
    } else {
      console.warn('Printer device not properly connected or unsupported.');
    }
  }
}

export const printService = new PrintService();
