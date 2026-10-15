Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class WinList {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  public static List<string> Titles() {
    var list = new List<string>();
    EnumWindows((h, l) => {
      if (IsWindowVisible(h)) {
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        var t = sb.ToString();
        if (t.Length > 0) list.Add(t);
      }
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@
[WinList]::Titles() | Where-Object { $_ -like '*Chrome*' }
