# 홈 화면 위젯(AKickWidget) 타깃을 Xcode 프로젝트에 추가 (CI에서 실행, 여러 번 돌려도 안전)
require 'xcodeproj'

path = File.expand_path('../ios/App/App.xcodeproj', __dir__)
proj = Xcodeproj::Project.open(path)
if proj.targets.any? { |t| t.name == 'AKickWidget' }
  puts 'AKickWidget already present'
  exit 0
end

app = proj.targets.find { |t| t.name == 'App' }
app_cfg = app.build_configurations.first.build_settings
widget = proj.new_target(:app_extension, 'AKickWidget', :ios, app_cfg['IPHONEOS_DEPLOYMENT_TARGET'] || '15.0')

group = proj.main_group.new_group('AKickWidget', 'AKickWidget')
swift = group.new_file('AKickWidget.swift')
group.new_file('Info.plist')
group.new_file('AKickWidget.entitlements')
widget.add_file_references([swift])
widget.add_system_framework(%w[WidgetKit SwiftUI])

widget.build_configurations.each do |c|
  bs = c.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.anqua.akick.widget'
  bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
  bs['INFOPLIST_FILE'] = 'AKickWidget/Info.plist'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['CODE_SIGN_ENTITLEMENTS'] = 'AKickWidget/AKickWidget.entitlements'
  bs['SWIFT_VERSION'] = '5.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1'
  bs['MARKETING_VERSION'] = app_cfg['MARKETING_VERSION'] || '1.0'
  bs['CURRENT_PROJECT_VERSION'] = app_cfg['CURRENT_PROJECT_VERSION'] || '1'
  bs['SKIP_INSTALL'] = 'YES'
  bs['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  bs['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = ''
end

app.add_dependency(widget)
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(widget.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts 'AKickWidget added'
