// ask for app requirement
// install the latest lib
// edit configuration files

var prompt = require('prompt');
var fs = require('fs');
var path = require('path');
var request = require('request');
var unzip = require('unzip');
var libxmljs = require("libxmljs");
var jf = require('jsonfile')
var util = require('util')
var clc = require('cli-color');
var dir = require('node-dir');
var _ = require('underscore');


exports.install = function() {
    var settings = jf.readFileSync("pushbots.json");
    startBot(settings);
}

function startBot(settings) {
    var androidXml = fs.readFileSync('AndroidManifest.xml').toString();
    var packageName = getPackageName(androidXml);
    // downloading the latest lib
    console.log(clc.red('Downloading latest Pushbots library ...'));
    downloadLibrary(function() {
        //creating pushbots.xml
        console.log(clc.cyan("Creating configuration files.."));
        insertPushBotsXML(settings, function() {
            //modifying manifest
            editManifest(androidXml, packageName, settings, function() {
                console.log(clc.red("initalizing library .."));
                var activity = findActivity(androidXml);
                var MainActivity = initalizeLibrary(activity, packageName);
                console.log(clc.green("success!"));
            })
        });
    })
}

function editManifest(androidXml, packageName, settings, cb) {
    androidXml = clearPermissions(androidXml, packageName);
    androidXml = clearIntentAndReciever(androidXml, packageName);
    androidXml = addIntent(androidXml, packageName);
    androidXml = addPermissions(androidXml, packageName);
    androidXml = addReciever(androidXml, packageName);
    console.log("modifing manifest ...");
    fs.writeFileSync('AndroidManifest.xml', androidXml);

    cb();
}

function downloadLibrary(cb) {
    var toDownload=  path.join('.', 'libs');

    var latesLibUrl = "http://pushbots.com/developer/download/android/latest";
    request({
        url: latesLibUrl
    }).pipe(unzip.Extract({
        path: toDownload
    }));
    cb();
}

function insertPushBotsXML(result, cb) {
    var resFile = path.join('.', 'res', 'values', 'pushbots.xml');
    var resContent = '<?xml version="1.0" encoding="utf-8"?>\n\
<resources>\n\
    <!-- Pushbots Application ID  -->\n\
    <string name="pb_appid">' + result.App_ID + '</string>\n\
    <!-- GCM Sender ID -->\n\
    <string name="pb_senderid">' + result.GCM_Sender_ID + '</string>\n\
    <!-- Pushbots Log Level  log Tag "PB2" -->\n\
    <string name="pb_logLevel">DEBUG</string>\n\
</resources>';
    fs.writeFileSync(resFile, resContent);
    cb();
}

function getPackageName(xml) {
    var doc = libxmljs.parseXml(xml);
    return doc.root().attr('package').value();
}


function addIntent(androidXml, packageName) {
    var repalced = /<intent-filter>([\s\S]*)android.intent.action.MAIN([\s\S]*)<\/intent-filter>/.exec(androidXml);
    if (repalced.length > 0)
        repalced = repalced[0];

    var intent = '<intent-filter>\n\
    <action android:name="' + packageName + '.MESSAGE" />\n\
    <category android:name="android.intent.category.DEFAULT" />\n\
</intent-filter>'

    return androidXml.replace(repalced, repalced + '\n' + intent);
}

function addPermissions(androidXml, packageName) {
    var permssion = '\n\
    <!-- GCM connects to Google Services. -->\n\
    <uses-permission android:name="android.permission.INTERNET" />\n\
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>\n\
    <!-- GCM requires a Google account. -->\n\
    <uses-permission android:name="android.permission.GET_ACCOUNTS" />\n\
    <uses-permission android:name="android.permission.WAKE_LOCK" />\n\
    <permission android:name="' + packageName + '.permission.C2D_MESSAGE" android:protectionLevel="signature" />\n\
    <uses-permission android:name="' + packageName + '.permission.C2D_MESSAGE" />\n\
    <!-- This app has permission to register and receive dataf message. -->\n\
    <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />\n\
</manifest>';

    return androidXml.replace('</manifest>', permssion);
}

function addReciever(androidXml, packageName) {
    var receiver = '\n\
        <receiver\n\
            android:name="com.pushbots.google.gcm.GCMBroadcastReceiver"\n\
        android:permission="com.google.android.c2dm.permission.SEND" >\n\
            <intent-filter>\n\
                <!-- Receives the actual messages. -->\n\
                <action android:name="com.google.android.c2dm.intent.RECEIVE" />\n\
                <!-- Receives the registration id. -->\n\
                <action android:name="com.google.android.c2dm.intent.REGISTRATION" />\n\
                <category android:name="' + packageName + '" />\n\
            </intent-filter>\n\
        </receiver>\n\
        <receiver android:name="com.pushbots.push.DefaultPushHandler" />\n\
        <service android:name="com.pushbots.push.GCMIntentService" />\n\
</application>';
    return androidXml.replace('</application>', receiver);

}

function findActivity(androidXml) {
    var doc = libxmljs.parseXml(androidXml.split("android:").join(""));
    var activities = doc.find('/manifest/application/activity');

    // console.log('activities = ', activities);
    for (var i = activities.length - 1; i >= 0; i--) {
        var activity = activities[i];
        // console.log(activity.toString());
        var intent = activity.find('intent-filter/action[@name="android.intent.action.MAIN"]');
        // console.log('intents = ', intent);
        if (intent && intent.length > 0) {
            return activity.attr('name').value();
        }

    }
}
function clearPermissions(androidXml, packageName) {
    var permission_1 = /<uses-permission(.*)android:name="android.permission.INTERNET"(.*)\/>/
    var permission_2 = /<uses-permission(.*)android:name="android.permission.ACCESS_NETWORK_STATE"(.*)\/>/
    var permission_3 = /<uses-permission(.*)android:name="android.permission.GET_ACCOUNTS"(.*)\/>/
    var permission_4 = /<uses-permission(.*)android:name="android.permission.WAKE_LOCK"(.*)\/>/
    var permission_5 = new RegExp('<permission(.*)android:name="' + packageName + '.permission.C2D_MESSAGE"(.*)android:protectionLevel="signature"(.*)\/>', "");
    var permission_6 = new RegExp('<uses-permission(.*)android:name="' + packageName + '.permission.C2D_MESSAGE"(.*)\/>', "");
    var permission_7 = /<uses-permission(.*)android:name="com.google.android.c2dm.permission.RECEIVE"(.*)\/>/;
    var result = androidXml.replace(permission_1, '');
    result = result.replace(permission_2, '');
    result = result.replace(permission_3, '')
    result = result.replace(permission_4, '')
    result = result.replace(permission_5, '')
    result = result.replace(permission_6, '')
    result = result.replace(permission_7, '')
    return result;
}

function clearIntentAndReciever(androidXml, packageName) {
    var reciever1 = /<receiver(.*)android:name="com.pushbots.push.DefaultPushHandler" \/>/gi
    var reciever2 = /<service(.*)android:name="com.pushbots.push.GCMIntentService" \/>/gi
    var koko = androidXml.replace(reciever1, '');
    koko = koko.replace(reciever2, '');

    var rePattern = new RegExp(/<intent-filter>([\s\S]*?)<\/intent-filter>/gm);
    var arrMatches = androidXml.match(rePattern);
    var recieverPattern = new RegExp(/<intent-filter>([\s\S]*?)<\/intent-filter>/gm);
    _.each(arrMatches, function(v) {
        if (v.indexOf(packageName+".MESSAGE") > 0) {
            koko = koko.replace(v, "")
        }
    });

    return koko;



}
function initalizeLibrary(activityName, packageName) {
    var activityFolder = packageName.split('.').join(path.sep);
    var filename = activityName.split('.').join(path.sep);
    var mysplit = activityName.split('.');
    var u = _.last(mysplit);
    var restofPackageName = _.without(mysplit, u).join(".");

    //var Filepath = "src" + path.sep + activityFolder + path.sep + filename + ".java";
    var Filepath = path.join( "src", activityFolder, filename + ".java");

    var readMainActivity = fs.readFileSync(Filepath).toString();
    var pattern = /protected void onCreate([\s\S]*)super.onCreate(.*)/.exec(readMainActivity);
    if (pattern.length > 0)
        pattern = pattern[0];

    var pb = '\t\tPushbots.sharedInstance().init(this);'
    var regexx = new RegExp("package " + packageName + "", "");
    //console.log(regexx);
    var importLibrary = regexx.exec(readMainActivity);
    var importSyntax = 'package ' + packageName +restofPackageName + ';\n import com.pushbots.push.Pushbots';
    if (importLibrary.length > 0) {
        //if there's package 
        //lets make sure we don't have pushbots imported
        if (readMainActivity.indexOf('import com.pushbots.push.Pushbots') < 0) {
            //
            var resContent = readMainActivity.replace(regexx, importSyntax);
        } else {
            var resContent = readMainActivity;

        }
        var addBefore = resContent.indexOf('Pushbots.sharedInstance().init(this)');
        if (addBefore < 0) {
            resContent = resContent.replace(pattern, pattern + '\n' + pb);
            fs.writeFileSync(Filepath, resContent);
            //console.log(Filepath);
            return resContent;

        } else {
            return readMainActivity;
        }
    }


}