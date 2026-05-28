import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { ZodError } from 'zod'
import { formatZodError } from './format-zod-error'
import { GraphValidationError } from './graph-validation.error'

@Catch(BadRequestException, GraphValidationError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException | GraphValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    if (exception instanceof GraphValidationError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: exception.errors,
        warnings: exception.warnings
      })
      return
    }

    const cause = (exception as BadRequestException).cause
    if (cause instanceof ZodError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: formatZodError(cause),
        warnings: []
      })
      return
    }

    // Plain BadRequestException → forward as 400 with its body
    const status = (exception as HttpException).getStatus()
    res.status(status).json(exception.getResponse())
  }
}
