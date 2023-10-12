let NdefRecord;
let NdefMessage;

let nfcAdapter;
let nfcDefaultAdapter;
let waiting;
let main;
let pendingIntent;
let intentFiltersArray;
let intentFilter;
let techListsArray;
let readVueInstance;

let readyRead = false;
let readyWriteData = false;
// export function initialize(instance) {
//   readVueInstance = instance;
// }
export default {
  data() {
    return {
      currentNFCInfo: [], //NFC 读取消息；
      bannerShow: false,
      remark: '',
      message: '',
      count: 0,
      timestampHide: '',
      timestampShow: '',
      writeCode: undefined,
      hasNFC: true,
    };
  },
  methods: {
    initialize(instance) {
      readVueInstance = instance;
    },
    listenNFCStatus() {
      try {
        console.log('Init NFC...');
        main = plus.android.runtimeMainActivity();
        const Intent = plus.android.importClass('android.content.Intent');
        const Activity = plus.android.importClass('android.app.Activity');
        const PendingIntent = plus.android.importClass('android.app.PendingIntent');
        intentFilter = plus.android.importClass('android.content.IntentFilter');
        nfcAdapter = plus.android.importClass('android.nfc.NfcAdapter');
        nfcDefaultAdapter = nfcAdapter.getDefaultAdapter(main);

        if (nfcDefaultAdapter == null) {
          uni.showToast({
            title: '设备不支持NFC！',
            icon: 'none',
          });
          return;
        } else if (!nfcDefaultAdapter.isEnabled()) {
          uni.showToast({
            title: '请在系统设置中先启用NFC功能！',
            icon: 'none',
          });
          return;
        } else this.hasNFC = false;

        let intent = new Intent(main, main.getClass());
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        pendingIntent = PendingIntent.getActivity(main, 0, intent, 0);
        let ndef = new intentFilter('android.nfc.action.TECH_DISCOVERED');
        ndef.addDataType('*/*');

        intentFiltersArray = [ndef];
        techListsArray = [
          ['android.nfc.tech.IsoDep'],
          ['android.nfc.tech.NfcA'],
          ['android.nfc.tech.NfcB'],
          ['android.nfc.tech.NfcF'],
          ['android.nfc.tech.Ndef'],
          ['android.nfc.tech.NfcV'],
          ['android.nfc.tech.NdefFormatable'],
          ['android.nfc.tech.MifareClassic'],
          ['android.nfc.tech.MifareUltralight'],
        ];
      } catch (e) {
        console.error(e);
      }
    },
    handleNfcData() {
      NdefRecord = plus.android.importClass('android.nfc.NdefRecord');
      NdefMessage = plus.android.importClass('android.nfc.NdefMessage');
      const intent = main.getIntent();

      if ('android.nfc.action.TECH_DISCOVERED' == intent.getAction()) {
        if (readyWriteData) {
          this.NFCWrite(intent);
          readyWriteData = false;
        }
        if (readyRead) {
          this.NFCRead(intent);
          readyRead = false;
        }
      } else {
        // waiting.close()
        console.log('nfc读取失败');
      }
    },
    NFCRead(intent) {
      try {
        waiting = plus.nativeUI.showWaiting('请将NFC标签靠近！');
        waiting.setTitle('请勿移开标签\n正在读取数据...');

        const tag = plus.android.importClass('android.nfc.Tag');
        waiting.close();

        const Parcelable = plus.android.importClass('android.os.Parcelable');

        const rawmsgs = intent.getParcelableArrayExtra(nfcAdapter.EXTRA_NDEF_MESSAGES);

        if (rawmsgs != null && rawmsgs.length > 0) {
          waiting.close();
          const records = rawmsgs[0].getRecords();
          const result = records[0].getPayload();

          if (result != null) {
            const text = plus.android.newObject('java.lang.String', result);
            this.NFCAfter(text);
            if (this.$store.state.nfc.pageCode == 3) {
              // console.log(JSON.stringify(this))
              readVueInstance.afterRead(text);
            } else if (this.$store.state.nfc.pageCode == 2) {
              readVueInstance.afterRead(text);
            }
            this.currentNFCInfo = text;
          } else {
            this.currentNFCInfo = '';
          }
        } else {
          console.error('NFC获取失败');
          readVueInstance.currentCode = null;
          readVueInstance.isEmptyCard = true;
          uni.showToast({
            title: 'NFC获取失败或卡号为空,请重新写卡.',
            icon: 'none',
          });
        }
      } catch (e) {
        console.error(e);
        console.error('NFC获取失败,丢出异常');
        waiting.close();
        uni.showToast({
          title: 'NFC获取失败,请重新写卡.',
          icon: 'none',
        });
      }
    },
    readData() {
      readyRead = true;
      //  waiting = plus.nativeUI.showWaiting("请将NFC标签靠近！");
      setTimeout(this.handleNfcData, 1000);
    },
    NFCWrite(intent) {
      try {
        waiting = plus.nativeUI.showWaiting('请将NFC标签靠近！');
        waiting.setTitle('请勿移开标签\n正在写入...');

        // var text = document.getElementById('text').value;
        // 写入需要的信息
        const textBytes = plus.android.invoke(this.writeCode, 'getBytes');

        const textRecord = new NdefRecord(
          NdefRecord.TNF_MIME_MEDIA,
          plus.android.invoke('text/plain', 'getBytes'),
          plus.android.invoke('', 'getBytes'),
          textBytes,
        );

        const message = new NdefMessage([textRecord]);

        const Ndef = plus.android.importClass('android.nfc.tech.Ndef');
        const NdefFormatable = plus.android.importClass('android.nfc.tech.NdefFormatable');

        const tag = intent.getParcelableExtra(nfcAdapter.EXTRA_TAG);
        const ndef = Ndef.get(tag);
        if (ndef != null) {
          let size = message.toByteArray().length;

          console.log('size=' + size);
          ndef.connect();

          if (!ndef.isWritable()) {
            console.log('tag不允许写入');
            waiting.close();
            uni.showToast({
              title: 'tag不允许写入.',
              icon: 'none',
            });
            return;
          }

          if (ndef.getMaxSize() < size) {
            console.log('文件大小超出容量');
            waiting.close();
            uni.showToast({
              title: '文件大小超出容量.',
              icon: 'none',
            });
            return;
          }

          // console.log('写入数据：' + JSON.stringify(message) + ' __TYPE__: ' + JSON.stringify(message.__TYPE__));
          ndef.writeNdefMessage(message);

          waiting.close();
          // console.log("写入数据成功.")
          uni.showToast({
            title: '写入数据成功.',
            icon: 'none',
          });

          // this.writeCode = "XJD:" + this.detailObj.code
          this.scrapCode(this.writeCode); //数据写入成功后，数据关联成功；

          return;
        } else {
          const format = NdefFormatable.get(tag);

          if (format != null) {
            try {
              format.connect();
              format.format(message);
              console.log('格式化tag并且写入message');
              waiting.close();
              return;
            } catch (e) {
              console.error('格式化tag失败.');
              waiting.close();
              uni.showToast({
                title: '格式化tag失败.',
                icon: 'none',
              });
              return;
            }
          } else {
            console.error('Tag不支持NDEF');
            uni.showToast({
              title: 'Tag不支持NDEF',
              icon: 'none',
            });
            waiting.close();
            return;
          }
        }
      } catch (e) {
        console.error('error=' + e);
        waiting.close();
        console.error('写入失败');
      }
    },
    writeData() {
      readyWriteData = true;
      // waiting = plus.nativeUI.showWaiting("请将NFC标签靠近！");
      setTimeout(this.handleNfcData, 1000);
    },
  },
  onLaunch() {
    this.listenNFCStatus();
  },
  onShow() {
    // 由于调用相机会触发次方法 需用全局属性cameraForNFC控制
    if (!this.hasNFC) {
      this.timestampShow = new Date().getTime();
      const TimeScale = this.timestampShow - this.timestampHide;
      nfcDefaultAdapter.enableForegroundDispatch(main, pendingIntent, intentFiltersArray, techListsArray);
      if (this.count++ == 0) {
        // this.listenNFCStatus()
        return false;
      } else if (TimeScale > 400) {
        return false;
      } else if (this.$store.state.status.cameraForNFC) {
        // 由于调用相机会触发次方法 需用全局属性cameraForNFC控制
        this.readData();
      }
    }
  },
  onHide() {
    this.timestampHide = new Date().getTime();
  },
};
