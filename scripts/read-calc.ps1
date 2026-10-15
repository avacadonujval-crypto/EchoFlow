Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, 'Calculator')
$calc = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $calc) { Write-Output 'Calculator window not found'; exit 1 }
$resCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'CalculatorResults')
$res = $calc.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $resCond)
if ($res) { Write-Output ('RESULT: ' + $res.Current.Name) } else { Write-Output 'result element not found' }
