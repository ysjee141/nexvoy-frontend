const xcode = require('xcode');
const fs = require('fs');

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parse(function (err) {
  if (err) {
    console.error('Error parsing pbxproj:', err);
    process.exit(1);
  }

  // Define new known regions
  if (!myProj.pbxProjectSection()[myProj.getFirstProject()['uuid']].knownRegions.includes('ko')) {
    myProj.pbxProjectSection()[myProj.getFirstProject()['uuid']].knownRegions.push('ko');
  }

  // Create variant group for InfoPlist.strings if it doesn't exist
  myProj.addLocalizationVariantGroup('InfoPlist.strings');

  // Add files to the variant group
  myProj.addResourceFile('en.lproj/InfoPlist.strings', { variantGroup: true });
  myProj.addResourceFile('ko.lproj/InfoPlist.strings', { variantGroup: true });

  fs.writeFileSync(projectPath, myProj.writeSync());
  console.log('Successfully updated App.xcodeproj for iOS localization.');
});
