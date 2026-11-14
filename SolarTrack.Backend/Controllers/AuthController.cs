using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SolarTrack.Backend.Data;
using SolarTrack.Backend.Models.Entities;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class AuthController : ControllerBase
{
    private readonly SolarTrackDbContext _dbContext;
    private readonly IDatabaseService _dbService;
    private readonly IDapperConnectionFactory _connFactory;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        SolarTrackDbContext dbContext,
        IDatabaseService dbService,
        IDapperConnectionFactory connFactory,
        ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _dbService = dbService;
        _connFactory = connFactory;
        _logger = logger;
    }

    public class LoginRequest
    {
        public string? Userid { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
    }

    [HttpPost("api/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var inputId = (request?.Userid ?? request?.Username ?? "").Trim().ToLowerInvariant();
        var inputPass = (request?.Password ?? "").ToString();

        if (string.IsNullOrWhiteSpace(inputId) || string.IsNullOrWhiteSpace(inputPass))
        {
            return BadRequest(new { success = false, error = "User ID and Password are required" });
        }

        User? foundUser = null;

        if (_connFactory.IsConfigured)
        {
            try
            {
                var users = await _dbContext.Users.AsNoTracking().ToListAsync();
                foundUser = users.FirstOrDefault(u =>
                    (string.Equals(u.userid, inputId, StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(u.email, inputId, StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(u.username, inputId, StringComparison.OrdinalIgnoreCase)) &&
                    u.password == inputPass);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("EF Core query for users failed: {Msg}", ex.Message);
            }
        }

        if (foundUser == null)
        {
            var rawUsers = await _dbService.GetTableAsync("users");
            foreach (var u in rawUsers)
            {
                var uid = (u.TryGetValue("userid", out var id1) ? id1 : (u.TryGetValue("UserID", out var id2) ? id2 : null))?.ToString()?.Trim().ToLowerInvariant() ?? "";
                var uemail = (u.TryGetValue("email", out var e1) ? e1 : null)?.ToString()?.Trim().ToLowerInvariant() ?? "";
                var uname = (u.TryGetValue("username", out var n1) ? n1 : null)?.ToString()?.Trim().ToLowerInvariant() ?? "";
                var upass = (u.TryGetValue("password", out var p1) ? p1 : (u.TryGetValue("Password", out var p2) ? p2 : null))?.ToString() ?? "";

                if ((uid == inputId || uemail == inputId || uname == inputId) && upass == inputPass)
                {
                    foundUser = new User
                    {
                        userid = uid,
                        username = uname,
                        email = uemail,
                        mobile = u.TryGetValue("mobile", out var mob) ? mob?.ToString() : "",
                        role = u.TryGetValue("role", out var r) ? r?.ToString() : "user",
                        status = u.TryGetValue("status", out var st) ? st?.ToString() : "Approved"
                    };
                    break;
                }
            }
        }

        if (foundUser == null)
        {
            _logger.LogWarning("[Auth Failed] Invalid login attempt for: {User}", inputId);
            return Unauthorized(new { success = false, error = "Invalid User ID/Email or Password" });
        }

        if (string.Equals(foundUser.status, "Pending", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { success = false, error = "Your account is pending Admin approval." });
        }

        if (string.Equals(foundUser.status, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { success = false, error = "Your account registration was rejected by Admin." });
        }

        _logger.LogInformation("[Auth Success] User {User} logged in successfully (role: {Role})", foundUser.userid, foundUser.role);
        return Ok(new
        {
            success = true,
            user = new
            {
                userid = foundUser.userid,
                username = foundUser.username,
                role = foundUser.role,
                email = foundUser.email,
                mobile = foundUser.mobile
            }
        });
    }

    [HttpGet("api/auth-config")]
    public async Task<IActionResult> GetAuthConfig()
    {
        var users = await _dbService.GetTableAsync("users");
        var rolesList = await _dbService.GetTableAsync("roles");
        var roles = rolesList.Select(r => r.TryGetValue("role", out var val) ? val?.ToString() : null)
                             .Where(r => !string.IsNullOrEmpty(r))
                             .ToList();

        return Ok(new { users, roles });
    }

    public class AuthConfigPayload
    {
        public List<Dictionary<string, object?>>? Users { get; set; }
        public List<string>? Roles { get; set; }
    }

    [HttpPost("api/auth-config")]
    public async Task<IActionResult> SaveAuthConfig([FromBody] AuthConfigPayload payload)
    {
        if (payload?.Users == null || payload.Roles == null)
            return BadRequest(new { error = "Invalid payload" });

        // 1. Sync Roles
        var currentRolesList = await _dbService.GetTableAsync("roles");
        var currentRoles = currentRolesList.Select(r => r.TryGetValue("role", out var val) ? val?.ToString() : null)
                                           .Where(r => !string.IsNullOrEmpty(r))
                                           .ToList();

        foreach (var r in payload.Roles)
        {
            if (!currentRoles.Contains(r))
            {
                await _dbService.InsertRowAsync("roles", new Dictionary<string, object?> { ["role"] = r });
            }
        }

        foreach (var r in currentRoles)
        {
            if (!payload.Roles.Contains(r!) && !string.Equals(r, "admin", StringComparison.OrdinalIgnoreCase) && !string.Equals(r, "user", StringComparison.OrdinalIgnoreCase) && !string.Equals(r, "employee", StringComparison.OrdinalIgnoreCase))
            {
                await _dbService.DeleteRowAsync("roles", "role", r!);
            }
        }

        // 2. Sync Users
        var currentUsers = await _dbService.GetTableAsync("users");
        var newUserids = payload.Users.Select(u => (u.TryGetValue("userid", out var uid) ? uid?.ToString() : "")?.ToLowerInvariant()).ToList();

        foreach (var cu in currentUsers)
        {
            var cuid = (cu.TryGetValue("userid", out var uid) ? uid?.ToString() : "")?.ToLowerInvariant();
            if (!string.IsNullOrEmpty(cuid) && !newUserids.Contains(cuid) && cuid != "admin")
            {
                await _dbService.DeleteRowAsync("users", "userid", cuid);
            }
        }

        foreach (var u in payload.Users)
        {
            var userid = (u.TryGetValue("userid", out var uid) ? uid?.ToString() : "")?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(userid)) continue;

            var existing = currentUsers.FirstOrDefault(cu =>
                string.Equals((cu.TryGetValue("userid", out var id) ? id?.ToString() : null)?.ToLowerInvariant(), userid));

            var userData = new Dictionary<string, object?>
            {
                ["userid"] = userid,
                ["username"] = u.TryGetValue("username", out var un) ? un : userid,
                ["email"] = u.TryGetValue("email", out var em) ? em : (existing != null && existing.TryGetValue("email", out var exEm) ? exEm : $"{userid}@example.com"),
                ["mobile"] = u.TryGetValue("mobile", out var mb) ? mb : (existing != null && existing.TryGetValue("mobile", out var exMb) ? exMb : ""),
                ["password"] = u.TryGetValue("password", out var pw) ? pw : "",
                ["role"] = u.TryGetValue("role", out var rl) ? rl : "user",
                ["status"] = u.TryGetValue("status", out var st) ? st : (existing != null && existing.TryGetValue("status", out var exSt) ? exSt : "Approved"),
                ["created_at"] = existing != null && existing.TryGetValue("created_at", out var exCa) ? exCa : DateTime.UtcNow.ToString("o")
            };

            await _dbService.InsertRowAsync("users", userData);
        }

        return Ok(new { success = true });
    }

    public class RegisterRequest
    {
        public string? Userid { get; set; }
        public string? Username { get; set; }
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? Mobile { get; set; }
        public string? Role { get; set; }
    }

    [HttpPost("api/register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var userid = (request?.Userid ?? "").Trim().ToLowerInvariant();
        var username = (request?.Username ?? "").Trim();
        var email = (request?.Email ?? "").Trim().ToLowerInvariant();
        var password = request?.Password ?? "";
        var role = !string.IsNullOrWhiteSpace(request?.Role) ? request.Role : "user";

        if (string.IsNullOrEmpty(userid) || string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            return BadRequest(new { error = "Please provide userid, username, email, and password." });
        }

        if (!System.Text.RegularExpressions.Regex.IsMatch(userid, @"^[a-z0-9_-]+$"))
        {
            return BadRequest(new { error = "User ID must be lowercase alphanumeric, underscore, or hyphen only." });
        }

        var users = await _dbService.GetTableAsync("users");
        if (users.Any(u => string.Equals((u.TryGetValue("userid", out var id) ? id?.ToString() : null)?.ToLowerInvariant(), userid)))
        {
            return BadRequest(new { error = $"User ID \"{userid}\" is already in use." });
        }

        if (users.Any(u => string.Equals((u.TryGetValue("email", out var em) ? em?.ToString() : null)?.ToLowerInvariant(), email)))
        {
            return BadRequest(new { error = $"Email \"{email}\" is already in use." });
        }

        var newUser = new Dictionary<string, object?>
        {
            ["userid"] = userid,
            ["username"] = username,
            ["email"] = email,
            ["mobile"] = request?.Mobile ?? "",
            ["password"] = password,
            ["role"] = role,
            ["status"] = "Pending",
            ["created_at"] = DateTime.UtcNow.ToString("o")
        };
        await _dbService.InsertRowAsync("users", newUser);

        var newNotif = new Dictionary<string, object?>
        {
            ["type"] = "new_user_registration",
            ["user_id"] = userid,
            ["message"] = $"New user registration request: {username} ({userid}, role: {role})",
            ["status"] = "unread",
            ["created_at"] = DateTime.UtcNow.ToString("o")
        };
        await _dbService.InsertRowAsync("notifications", newNotif);

        return Ok(new { success = true, message = "Registration submitted. Please wait for admin approval." });
    }

    public class ForgotPasswordRequest
    {
        public string? Email { get; set; }
    }

    [HttpPost("api/forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var email = (request?.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { error = "Please provide an email address." });
        }

        var users = await _dbService.GetTableAsync("users");
        var user = users.FirstOrDefault(u => string.Equals((u.TryGetValue("email", out var em) ? em?.ToString() : null)?.ToLowerInvariant(), email));

        if (user != null && user.TryGetValue("userid", out var uid) && uid != null)
        {
            var tokenBytes = RandomNumberGenerator.GetBytes(20);
            var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();
            var expires = DateTime.UtcNow.AddHours(1).ToString("o");

            await _dbService.UpdateRowAsync("users", "userid", uid, new Dictionary<string, object?>
            {
                ["reset_token"] = token,
                ["reset_expires"] = expires
            });
        }

        return Ok(new { success = true, message = "If the email exists in our system, a password reset link has been sent." });
    }

    public class ResetPasswordRequest
    {
        public string? Token { get; set; }
        public string? Password { get; set; }
    }

    [HttpPost("api/reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var token = request?.Token ?? "";
        var newPassword = request?.Password ?? "";

        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(newPassword))
        {
            return BadRequest(new { error = "Missing token or new password." });
        }

        var users = await _dbService.GetTableAsync("users");
        var user = users.FirstOrDefault(u => string.Equals((u.TryGetValue("reset_token", out var t) ? t?.ToString() : null), token));

        if (user == null || !user.TryGetValue("userid", out var uid) || uid == null)
        {
            return BadRequest(new { error = "Password reset token is invalid." });
        }

        if (user.TryGetValue("reset_expires", out var expObj) && DateTime.TryParse(expObj?.ToString(), out var expiryDate) && expiryDate < DateTime.UtcNow)
        {
            return BadRequest(new { error = "Password reset token has expired." });
        }

        await _dbService.UpdateRowAsync("users", "userid", uid, new Dictionary<string, object?>
        {
            ["password"] = newPassword,
            ["reset_token"] = null,
            ["reset_expires"] = null
        });

        return Ok(new { success = true, message = "Password has been reset successfully." });
    }

    [HttpGet("api/roles")]
    public async Task<IActionResult> GetRoles()
    {
        var rolesList = await _dbService.GetTableAsync("roles");
        var roles = rolesList.Select(r => r.TryGetValue("role", out var val) ? val?.ToString() : null)
                             .Where(r => !string.IsNullOrEmpty(r))
                             .ToList();

        if (!roles.Any(r => string.Equals(r, "employee", StringComparison.OrdinalIgnoreCase)))
        {
            roles.Add("Employee");
        }

        return Ok(new { success = true, roles });
    }

    [HttpPost("api/logout")]
    public IActionResult Logout()
    {
        Response.Headers.Append("Clear-Site-Data", "\"cache\", \"cookies\", \"storage\"");
        Response.Cookies.Delete("session");
        return Ok(new { success = true });
    }
}
