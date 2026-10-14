//go:build windows

// Command launcher is a small Windows exe that carries the whole app (index.html)
// inside it, writes it to %LOCALAPPDATA%\R6CalloutDrill and opens it in an Edge
// (or Chrome) app window. The fixed location keeps saved progress between runs.
package main

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

//go:embed index.html
var page []byte

func main() {
	dir := filepath.Join(os.Getenv("LOCALAPPDATA"), "R6CalloutDrill")
	if dir == "R6CalloutDrill" {
		dir = filepath.Join(os.TempDir(), "R6CalloutDrill")
	}
	_ = os.MkdirAll(dir, 0o755)
	file := filepath.Join(dir, "index.html")
	if err := os.WriteFile(file, page, 0o644); err != nil {
		fail("Could not write " + file + ": " + err.Error())
	}
	url := "file:///" + filepath.ToSlash(file)

	pf, pf86, local := os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")
	browsers := []string{
		filepath.Join(pf86, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(pf, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(pf, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(pf86, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(local, `Google\Chrome\Application\chrome.exe`),
	}
	for _, b := range browsers {
		if _, err := os.Stat(b); err == nil {
			// A separate profile keeps the app window apart from the user's normal browsing.
			profile := filepath.Join(dir, "browser-profile")
			cmd := exec.Command(b, "--app="+url, "--user-data-dir="+profile, "--window-size=1400,920", "--no-first-run")
			if cmd.Start() == nil {
				return
			}
		}
	}
	// No Edge or Chrome found: fall back to the default browser.
	if exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start() != nil {
		fail("Could not open a browser. Open this file yourself:\n" + file)
	}
}

func fail(msg string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(msg)
	c, _ := syscall.UTF16PtrFromString("R6 Callout Drill")
	box.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x10)
	os.Exit(1)
}
